export default async function handler(req, res) {

    // Solo acepta peticiones POST
    if (req.method !== "POST") {
        return res.status(405).json({ allowed: false, reason: "Metodo no permitido" })
    }

    // Leer los datos que manda el script de Lua
    const { userId, username, hwid, scriptName, token } = req.body

    // Verificar que el token secreto sea correcto
    // Este token lo defines tú en Vercel, nadie más lo sabe
    if (!token || token !== process.env.API_TOKEN) {
        return res.status(403).json({ allowed: false, reason: "Token invalido" })
    }

    // Verificar que llegaron todos los datos necesarios
    if (!userId || !username || !hwid) {
        return res.status(400).json({ allowed: false, reason: "Faltan datos" })
    }

    // Cargar tu lista de usuarios desde Vercel (nunca sale al público)
    let whitelist
    try {
        whitelist = JSON.parse(process.env.WHITELIST_DATA)
    } catch (e) {
        return res.status(500).json({ allowed: false, reason: "Error interno" })
    }

    // Función que busca a un usuario dentro de una lista
    function searchList(list) {
        if (!Array.isArray(list)) return { found: false, reason: null }

        for (const entry of list) {
            // Buscar por userId
            if (String(entry.userId) === String(userId)) {

                // Verificar que el username coincida con ese userId
                if (entry.username.toLowerCase() !== String(username).toLowerCase()) {
                    return { found: false, reason: "Username no coincide con el ID" }
                }

                // Verificar que el HWID coincida
                if (entry.hwid !== String(hwid)) {
                    return { found: false, reason: "Dispositivo no reconocido" }
                }

                // Verificar si está baneado
                if (entry.banned === true) {
                    return { found: false, reason: "Acceso revocado" }
                }

                // Todo correcto
                return { found: true }
            }
        }

        // No encontrado en esta lista (no es error, sigue buscando)
        return { found: false, reason: null }
    }

    // Buscar primero en la lista GLOBAL
    // Si está en global, tiene acceso a TODOS los scripts
    if (whitelist.global) {
        const resultado = searchList(whitelist.global)
        if (resultado.found) {
            return res.json({ allowed: true, accessType: "global" })
        }
        if (resultado.reason) {
            return res.json({ allowed: false, reason: resultado.reason })
        }
    }

    // Si no está en global, buscar en la lista del script específico
    // Ejemplo: "Jailxd" solo da acceso al script de Jailbreak
    if (scriptName && whitelist.scripts && whitelist.scripts[scriptName]) {
        const resultado = searchList(whitelist.scripts[scriptName])
        if (resultado.found) {
            return res.json({ allowed: true, accessType: scriptName })
        }
        if (resultado.reason) {
            return res.json({ allowed: false, reason: resultado.reason })
        }
    }

    // No está en ninguna lista
    return res.json({ allowed: false, reason: "No autorizado" })
}
