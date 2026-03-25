const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password')
    if (req.method === 'OPTIONS') return res.status(200).end()

    const authHeader = req.headers['x-admin-password']
    if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD)
        return res.status(403).json({ error: "No autorizado" })

    const supabase = createClient(process.env.JMODS_SUPABASE_URL, process.env.JMODS_SUPABASE_KEY)

    if (req.method === "GET") {
        const { data, error } = await supabase
            .from('jmods_users')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: error.message })

        // Normalizar: si hwids está vacío pero hwid existe, usarlo
        const normalized = (data || []).map(u => ({
            ...u,
            hwids: (u.hwids && u.hwids.length > 0)
                ? u.hwids
                : (u.hwid ? [u.hwid] : [])
        }))
        return res.json({ users: normalized })
    }

    if (req.method === "POST") {
        const { username, user_id, hwid, hwids, role, notes, expires } = req.body
        if (!username || !user_id)
            return res.status(400).json({ error: "Faltan datos (username, user_id)" })

        // Construir array de hwids
        let finalHwids = []
        if (hwids && Array.isArray(hwids) && hwids.length > 0) {
            finalHwids = hwids.filter(h => h && h.trim() !== '')
        } else if (hwid && hwid.trim() !== '') {
            finalHwids = [hwid.trim()]
        }
        if (finalHwids.length === 0)
            return res.status(400).json({ error: "Se requiere al menos un HWID" })

        const validRoles = ['owner', 'admin', 'follower']
        const finalRole = validRoles.includes(role) ? role : 'follower'

        const { data, error } = await supabase
            .from('jmods_users')
            .insert([{
                username,
                user_id: parseInt(user_id),
                hwid: finalHwids[0],       // compatibilidad con campo legacy
                hwids: finalHwids,
                role: finalRole,
                active: true,
                notes: notes || '',
                expires: expires !== undefined ? parseInt(expires) : 0
            }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, user: data[0] })
    }

    if (req.method === "PATCH") {
        const { id, username, hwid, hwids, role, active, notes, expires } = req.body
        const updates = {}
        if (username !== undefined) updates.username = username
        if (role     !== undefined) updates.role     = role
        if (active   !== undefined) updates.active   = active
        if (notes    !== undefined) updates.notes    = notes
        if (expires  !== undefined) updates.expires  = expires

        // Manejar hwids
        if (hwids !== undefined && Array.isArray(hwids)) {
            const filtered = hwids.filter(h => h && h.trim() !== '')
            if (filtered.length > 0) {
                updates.hwids = filtered
                updates.hwid  = filtered[0]  // mantener campo legacy
            }
        } else if (hwid !== undefined && hwid.trim() !== '') {
            updates.hwid  = hwid.trim()
            updates.hwids = [hwid.trim()]
        }

        const { error } = await supabase
            .from('jmods_users')
            .update(updates)
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    if (req.method === "DELETE") {
        const { id } = req.body
        const { error } = await supabase
            .from('jmods_users')
            .delete()
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    return res.status(405).json({ error: "Método no permitido" })
}
