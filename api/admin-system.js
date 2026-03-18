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

    // GET — lista todos los owners/admins
    if (req.method === "GET") {
        const { data, error } = await supabase
            .from('admin_system')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ users: data })
    }

    // POST — agregar owner o admin
    if (req.method === "POST") {
const { user_id, username, hwid, role } = req.body
if (!user_id || !username || !hwid || !role) {
    return res.status(400).json({ error: "Faltan datos: userId, username, hwid y role son requeridos" })
}
const { data, error } = await supabase
            .from('admin_system')
            .insert([{ user_id: parseInt(user_id), username, hwid: hwid || '', role }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, user: data[0] })
    }

    // PATCH — cambiar rol
    if (req.method === "PATCH") {
        const { id, role } = req.body
        const { error } = await supabase
            .from('admin_system')
            .update({ role })
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // DELETE — eliminar
    if (req.method === "DELETE") {
        const { id } = req.body
        const { error } = await supabase
            .from('admin_system')
            .delete()
            .eq('id', id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    return res.status(405).json({ error: "Metodo no permitido" })
}
