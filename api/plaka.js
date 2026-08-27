export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { image, mediaType } = req.body
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return res.status(200).json({ ok: false, error: 'API key bulunamadı' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image,
                },
              },
              {
                type: 'text',
                text: `Bu fotoğrafta bir Türkiye araç plakası var. Plakayı oku ve standart formatta yaz (il kodu + boşluk + harf(ler) + boşluk + rakam, örn "34 TT 213"). Plaka net görünmüyorsa veya okunamıyorsa "BULUNAMADI" yaz.

SADECE şu JSON formatında döndür, başka hiçbir metin ekleme:
{"plaka":""}`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(200).json({ ok: false, error: err.error?.message || 'API hatası' })
    }

    const data = await response.json()
    const text = (data.content?.[0]?.text || '').trim()

    let bilgi = null
    try { bilgi = JSON.parse(text) } catch {}
    if (!bilgi) {
      const m = text.match(/\{[\s\S]*?\}/)
      if (m) try { bilgi = JSON.parse(m[0]) } catch {}
    }

    if (bilgi && bilgi.plaka && bilgi.plaka !== 'BULUNAMADI') {
      return res.status(200).json({ ok: true, plaka: bilgi.plaka })
    }
    return res.status(200).json({ ok: false, error: 'Plaka okunamadı, net bir fotoğraf çekmeyi dene.' })

  } catch (error) {
    return res.status(200).json({ ok: false, error: error.message })
  }
}
