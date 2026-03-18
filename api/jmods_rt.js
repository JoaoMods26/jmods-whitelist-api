const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-token')
    if (req.method === 'OPTIONS') return res.status(200).end()

    const token = req.headers['x-api-token']
    if (!token || token !== process.env.API_TOKEN)
        return res.status(403).json({ error: "Token inválido" })

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    const { action } = req.body || req.query

    // ── HEARTBEAT (follower/admin/owner reporta que está vivo) ──
    if (action === 'heartbeat') {
        const { user_id, username, role, server_id, place_id } = req.body
        const { error } = await supabase
            .from('jmods_heartbeats')
            .upsert({
                user_id: parseInt(user_id),
                username,
                role,
                server_id,
                place_id: parseInt(place_id) || 0,
                last_seen: new Date().toISOString()
            }, { onConflict: 'user_id,server_id' })
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── GET HEARTBEATS (owner/admin pide ver quién está online) ──
    if (action === 'get_heartbeats') {
        const { server_id } = req.body
        const cutoff = new Date(Date.now() - 30000).toISOString() // últimos 30s
        const { data, error } = await supabase
            .from('jmods_heartbeats')
            .select('*')
            .eq('server_id', server_id)
            .gte('last_seen', cutoff)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ players: data })
    }

    // ── ENVIAR COMANDO ──
    if (action === 'send_command') {
        const { sender_id, sender_role, server_id, command, target } = req.body
        const { data, error } = await supabase
            .from('jmods_commands')
            .insert([{
                sender_id: parseInt(sender_id),
                sender_role,
                server_id,
                command,
                target: target || null,
                executed: false
            }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, id: data[0].id })
    }

    // ── LEER COMANDOS PENDIENTES (follower/admin los pide) ──
    if (action === 'get_commands') {
        const { server_id } = req.body
        const cutoff = new Date(Date.now() - 15000).toISOString()
        const { data, error } = await supabase
            .from('jmods_commands')
            .select('*')
            .eq('server_id', server_id)
            .eq('executed', false)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: true })
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ commands: data })
    }

    // ── MARCAR COMANDOS COMO EJECUTADOS ──
    if (action === 'ack_commands') {
        const { ids } = req.body
        if (!ids || ids.length === 0) return res.json({ success: true })
        const { error } = await supabase
            .from('jmods_commands')
            .update({ executed: true })
            .in('id', ids)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── ENVIAR EJECUCIÓN ──
    if (action === 'send_execution') {
        const { sender_id, server_id, target, code } = req.body
        const { data, error } = await supabase
            .from('jmods_executions')
            .insert([{
                sender_id: parseInt(sender_id),
                server_id: server_id || null,
                target,
                code,
                executed: false
            }])
            .select()
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true, id: data[0].id })
    }

    // ── LEER EJECUCIONES PENDIENTES ──
    if (action === 'get_executions') {
        const { user_id, username, server_id } = req.body
        const cutoff = new Date(Date.now() - 15000).toISOString()
        const { data, error } = await supabase
            .from('jmods_executions')
            .select('*')
            .eq('executed', false)
            .gte('created_at', cutoff)
        if (error) return res.status(500).json({ error: error.message })

        // Filtrar por target del lado server
        const filtered = data.filter(e => {
            return e.target === '.all' ||
                   (e.target === '.s' && e.server_id === server_id) ||
                   e.target === username
        })
        return res.json({ executions: filtered })
    }

    // ── ACK EJECUCIONES ──
    if (action === 'ack_executions') {
        const { ids } = req.body
        if (!ids || ids.length === 0) return res.json({ success: true })
        const { error } = await supabase
            .from('jmods_executions')
            .update({ executed: true })
            .in('id', ids)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── ENVIAR BRING ──
    if (action === 'send_bring') {
        const { sender_id, server_id, target_user_id } = req.body
        const { error } = await supabase
            .from('jmods_brings')
            .insert([{
                sender_id: parseInt(sender_id),
                server_id,
                target_user_id: parseInt(target_user_id),
                executed: false
            }])
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── LEER BRINGS PENDIENTES ──
    if (action === 'get_brings') {
        const { user_id, server_id } = req.body
        const cutoff = new Date(Date.now() - 15000).toISOString()
        const { data, error } = await supabase
            .from('jmods_brings')
            .select('*')
            .eq('server_id', server_id)
            .eq('target_user_id', parseInt(user_id))
            .eq('executed', false)
            .gte('created_at', cutoff)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ brings: data })
    }

    // ── ACK BRINGS ──
    if (action === 'ack_brings') {
        const { ids } = req.body
        if (!ids || ids.length === 0) return res.json({ success: true })
        const { error } = await supabase
            .from('jmods_brings')
            .update({ executed: true })
            .in('id', ids)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── VERIFICAR USUARIO JMODS (el script lua lo llama al inicio) ──
    if (action === 'verify_user') {
        const { user_id, hwid } = req.body
        const { data, error } = await supabase
            .from('jmods_users')
            .select('*')
            .eq('user_id', parseInt(user_id))
            .eq('active', true)
            .single()
        if (error || !data)
            return res.json({ verified: false, reason: "No autorizado" })
        if (data.hwid !== hwid)
            return res.json({ verified: false, reason: "HWID no coincide" })
        return res.json({ verified: true, role: data.role, username: data.username })
    }

    return res.status(400).json({ error: "Acción no reconocida" })
}
