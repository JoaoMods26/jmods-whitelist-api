import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {

    const authHeader = req.headers['x-admin-password']
    if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: "No autorizado" })
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    )

    if (req.method === "GET") {
        const { data, error } = await supabase
            .from('whitelist')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ users: data })
    }

    if (req.method === "POST") {
        const { username, user_id, hwid, script_name, expires, place_id } = req.body
        if (!username || !user_id || !hwid) {
            return res.status(400).json({ error: "Faltan datos" })
        }
        const { data, error } = await supabase
            .from('whitelist')
            .insert([{
                username,
                user_id: parseInt(user_id),
                hwid,
                script_name: script_name || 'global',
                banned: false,
                active: true,
                expires: expires || 0,
                place_id: place_id ? parseInt(place_id) : 0
            }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, user: data[0] })
    }

    if (req.method === "PATCH") {
        const { id, banned, active, expires } = req.body
        const updates = {}
        if (banned  !== undefined) updates.banned  = banned
        if (active  !== undefined) updates.active  = active
        if (expires !== undefined) updates.expires = expires
        const { error } = await supabase
            .from('whitelist')
            .update(updates)
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    if (req.method === "DELETE") {
        const { id } = req.body
        const { error } = await supabase
            .from('whitelist')
            .delete()
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    return res.status(405).json({ error: "Metodo no permitido" })
}
