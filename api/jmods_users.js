const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password')
    if (req.method === 'OPTIONS') return res.status(200).end()

    const authHeader = req.headers['x-admin-password']
    if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD)
        return res.status(403).json({ error: "No autorizado" })

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

    if (req.method === "GET") {
        const { data, error } = await supabase
            .from('jmods_users')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ users: data })
    }

    if (req.method === "POST") {
        const { username, user_id, hwid, role, notes } = req.body
        if (!username || !user_id || !hwid)
            return res.status(400).json({ error: "Faltan datos (username, user_id, hwid)" })

        const validRoles = ['owner', 'admin', 'follower']
        const finalRole = validRoles.includes(role) ? role : 'follower'

        const { data, error } = await supabase
            .from('jmods_users')
            .insert([{
                username,
                user_id: parseInt(user_id),
                hwid,
                role: finalRole,
                active: true,
                notes: notes || ''
            }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, user: data[0] })
    }

    if (req.method === "PATCH") {
        const { id, username, hwid, role, active, notes } = req.body
        const updates = {}
        if (username !== undefined) updates.username = username
        if (hwid     !== undefined) updates.hwid     = hwid
        if (role     !== undefined) updates.role     = role
        if (active   !== undefined) updates.active   = active
        if (notes    !== undefined) updates.notes    = notes

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
