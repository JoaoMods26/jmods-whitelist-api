const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-token')
    if (req.method === 'OPTIONS') return res.status(200).end()

    const token = req.headers['x-api-token']
    if (!token || token !== process.env.API_TOKEN)
        return res.status(403).json({ error: "Token inválido" })

    // ← Usa el Supabase separado para JMods
    const supabase = createClient(process.env.JMODS_SUPABASE_URL, process.env.JMODS_SUPABASE_KEY)
    const { action } = req.body || req.query

    // ── HEARTBEAT ──
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

    // ── GET HEARTBEATS ──
    if (action === 'get_heartbeats') {
        const { server_id } = req.body
        const cutoff = new Date(Date.now() - 30000).toISOString()
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

    // ── LEER COMANDOS PENDIENTES ──
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

    // ── ACK COMANDOS ──
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

    // ── VERIFICAR USUARIO ──
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
        if (data.expires !== 0 && Date.now() / 1000 > data.expires) {
            await supabase.from('jmods_users').update({ active: false }).eq('id', data.id)
            return res.json({ verified: false, reason: "Acceso expirado" })
        }
        return res.json({ verified: true, role: data.role, username: data.username })
    }

    // ── GET ALL ROLES ──
    if (action === 'get_all_roles') {
        const { data, error } = await supabase
            .from('jmods_users')
            .select('user_id, role, active')
            .eq('active', true)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ users: data })
    }

    // ── ENVIAR TRIGGER (owner activa a los followers) ──
    if (action === 'send_trigger') {
        const { server_id } = req.body
        const { error } = await supabase
            .from('jmods_heartbeats')
            .update({ trigger_active: true, trigger_at: new Date().toISOString() })
            .eq('server_id', server_id)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ success: true })
    }

    // ── GET TRIGGER (followers chequean si hay señal) ──
    if (action === 'get_trigger') {
        const { server_id } = req.body
        const cutoff = new Date(Date.now() - 35000).toISOString() // últimos 35s
        const { data, error } = await supabase
            .from('jmods_heartbeats')
            .select('trigger_active, trigger_at')
            .eq('server_id', server_id)
            .eq('trigger_active', true)
            .gte('trigger_at', cutoff)
            .limit(1)
        if (error) return res.status(500).json({ error: error.message })
        return res.json({ active: data && data.length > 0 })
    }

    return res.status(400).json({ error: "Acción no reconocida" })
}
