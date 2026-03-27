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

    // ── GET: Listar todos los usuarios ──
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

    // ── POST: Crear nuevo usuario ──
    if (req.method === "POST") {
        const { username, user_id, hwid, hwids, role, notes, expires } = req.body

        // Validación de campos obligatorios
        if (!username || !username.trim())
            return res.status(400).json({ error: "El campo 'username' es obligatorio" })

        if (!user_id)
            return res.status(400).json({ error: "El campo 'user_id' es obligatorio" })

        const parsedUserId = parseInt(user_id)
        if (isNaN(parsedUserId) || parsedUserId <= 0)
            return res.status(400).json({ error: "El 'user_id' debe ser un número válido" })

        // Construir array de hwids limpio
        let finalHwids = []

        if (hwids && Array.isArray(hwids) && hwids.length > 0) {
            finalHwids = hwids.map(h => (h || '').trim()).filter(h => h !== '')
        } else if (hwid && hwid.trim() !== '') {
            finalHwids = [hwid.trim()]
        }

        // Validar rol
        const validRoles = ['owner', 'admin', 'follower']
        const finalRole = validRoles.includes(role) ? role : 'follower'

        // Owners y admins NECESITAN HWID. Followers pueden entrar sin él.
        if (finalHwids.length === 0 && (finalRole === 'owner' || finalRole === 'admin')) {
            return res.status(400).json({
                error: `Los usuarios con rol '${finalRole}' requieren al menos un HWID`
            })
        }

        // Verificar si el user_id ya existe
        const { data: existing } = await supabase
            .from('jmods_users')
            .select('id, username')
            .eq('user_id', parsedUserId)
            .single()

        if (existing) {
            return res.status(409).json({
                error: `El user_id ${parsedUserId} ya está registrado como '${existing.username}'`
            })
        }

        // Parsear expires
        let finalExpires = 0
        if (expires !== undefined && expires !== null && expires !== '') {
            const parsed = parseInt(expires)
            finalExpires = isNaN(parsed) ? 0 : parsed
        }

        // Insertar
        const { data, error } = await supabase
            .from('jmods_users')
            .insert([{
                username: username.trim(),
                user_id: parsedUserId,
                hwid: finalHwids[0] || '',        // campo legacy — primer HWID o vacío
                hwids: finalHwids,                 // array completo
                role: finalRole,
                active: true,
                notes: (notes || '').trim(),
                expires: finalExpires
            }])
            .select()

        if (error) {
            // Manejo específico de errores de Supabase
            if (error.code === '23505') {
                return res.status(409).json({ error: "Este usuario ya existe (conflicto de clave única)" })
            }
            return res.status(500).json({ error: error.message })
        }

        return res.status(201).json({ success: true, user: data[0] })
    }

    // ── PATCH: Editar usuario existente ──
    if (req.method === "PATCH") {
        const { id, username, hwid, hwids, role, active, notes, expires } = req.body

        if (!id) return res.status(400).json({ error: "El campo 'id' es obligatorio para editar" })

        const updates = {}

        if (username  !== undefined) updates.username = username.trim()
        if (role      !== undefined) updates.role     = role
        if (active    !== undefined) updates.active   = active
        if (notes     !== undefined) updates.notes    = (notes || '').trim()
        if (expires   !== undefined) updates.expires  = parseInt(expires) || 0

        // Manejo de hwids en edición
        if (hwids !== undefined && Array.isArray(hwids)) {
            const filtered = hwids.map(h => (h || '').trim()).filter(h => h !== '')
            if (filtered.length > 0) {
                updates.hwids = filtered
                updates.hwid  = filtered[0]    // mantener campo legacy sincronizado
            }
        } else if (hwid !== undefined && hwid.trim() !== '') {
            updates.hwid  = hwid.trim()
            updates.hwids = [hwid.trim()]
        }

        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "No se enviaron campos para actualizar" })

        const { error } = await supabase
            .from('jmods_users')
            .update(updates)
            .eq('id', id)

        if (error) return res.status(500).json({ error: error.message })

        return res.json({ success: true })
    }

    // ── DELETE: Eliminar usuario ──
    if (req.method === "DELETE") {
        const { id } = req.body

        if (!id) return res.status(400).json({ error: "El campo 'id' es obligatorio para eliminar" })

        const { error } = await supabase
            .from('jmods_users')
            .delete()
            .eq('id', id)

        if (error) return res.status(500).json({ error: error.message })

        return res.json({ success: true })
    }

    return res.status(405).json({ error: "Método no permitido: " + req.method })
}
