import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ allowed: false })
    }

    const { userId, username, hwid, scriptName, token, placeId } = req.body

    if (!token || token !== process.env.API_TOKEN) {
        return res.status(403).json({ allowed: false, reason: "Token invalido" })
    }

    if (!userId || !username || !hwid) {
        return res.status(400).json({ allowed: false, reason: "Faltan datos" })
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    )

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .eq('user_id', userId)
        .in('script_name', ['global', scriptName || 'global'])

    if (error || !data || data.length === 0) {
        return res.json({ allowed: false, reason: "No autorizado" })
    }

    const entry = data[0]

    if (entry.username.toLowerCase() !== String(username).toLowerCase()) {
        return res.json({ allowed: false, reason: "Username no coincide" })
    }

    if (entry.hwid !== String(hwid)) {
        return res.json({ allowed: false, reason: "Dispositivo no reconocido" })
    }

    if (entry.banned) {
        return res.json({ allowed: false, reason: "Acceso revocado" })
    }

    if (!entry.active) {
        return res.json({ allowed: false, reason: "Acceso desactivado" })
    }

    // Auto-pausa al expirar
    if (entry.expires !== 0 && Date.now() / 1000 > entry.expires) {
        // Pausar automáticamente en la base de datos
        await supabase
            .from('whitelist')
            .update({ active: false })
            .eq('id', entry.id)

        return res.json({ allowed: false, reason: "Acceso expirado — membresía pausada automáticamente" })
    }

    // Verificar PlaceId
    if (entry.place_id !== 0 && placeId && entry.place_id !== parseInt(placeId)) {
        return res.json({ allowed: false, reason: "Acceso no valido para este juego" })
    }

    return res.json({ allowed: true, accessType: entry.script_name })
}
