const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== "POST") return res.status(405).json({ allowed: false })

    const { userId, username, hwid, currentPlaceId, requiredPlaceId, token } = req.body

    if (!token || token !== process.env.API_TOKEN)
        return res.status(403).json({ allowed: false, reason: "Token invalido" })
    if (!userId || !username || !hwid)
        return res.status(400).json({ allowed: false, reason: "Faltan datos" })

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    const { data, error } = await supabase.from('whitelist').select('*').eq('user_id', userId)

    if (error || !data || data.length === 0)
        return res.json({ allowed: false, reason: "No autorizado" })

    const entry = data.find(e => e.place_id === 0 || String(e.place_id) === String(requiredPlaceId))
    if (!entry) return res.json({ allowed: false, reason: "Sin acceso para este script" })

    if (entry.place_id !== 0 && String(currentPlaceId) !== String(entry.place_id))
        return res.json({ allowed: false, reason: "No estas en el juego correcto" })
    if (entry.username.toLowerCase() !== String(username).toLowerCase())
        return res.json({ allowed: false, reason: "Username no coincide" })
    if (entry.hwid !== String(hwid))
        return res.json({ allowed: false, reason: "Dispositivo no reconocido" })
    if (entry.banned)
        return res.json({ allowed: false, reason: "Acceso revocado" })
    if (!entry.active)
        return res.json({ allowed: false, reason: "Acceso desactivado" })
    if (entry.expires !== 0 && Date.now() / 1000 > entry.expires) {
        await supabase.from('whitelist').update({ active: false }).eq('id', entry.id)
        return res.json({ allowed: false, reason: "Acceso expirado" })
    }

    return res.json({ allowed: true })
}
