export default async function handler(req, res) {
    res.json({
        status: "ok",
        mensaje: "API funcionando correctamente",
        hora: new Date().toISOString(),
        variables: {
            tiene_api_token: !!process.env.API_TOKEN,
            tiene_admin_password: !!process.env.ADMIN_PASSWORD,
            tiene_supabase_url: !!process.env.SUPABASE_URL,
            tiene_supabase_key: !!process.env.SUPABASE_KEY
        }
    })
}
