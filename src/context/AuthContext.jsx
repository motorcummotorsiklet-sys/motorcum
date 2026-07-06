import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      fetchProfile(u?.id).finally(() => setLoading(false))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      fetchProfile(u?.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, profileData) => {
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (!error && data.user) {
      // profiles tablosuna ekle (aktif: false, rol: kullanici)
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        ad: profileData.ad,
        soyad: profileData.soyad,
        kullanici_adi: profileData.kullanici_adi,
        kan_grubu: profileData.kan_grubu || null,
        tc: profileData.tc || null,
        telefon: profileData.telefon || null,
        dogum_tarihi: profileData.dogum_tarihi || null,
        rol: 'kullanici',
        aktif: false,
      })

      // personel tablosuna da ekle (aktif: false)
      await supabase.from('personel').insert({
        ad: profileData.ad,
        soyad: profileData.soyad,
        telefon: profileData.telefon || null,
        email: email,
        rol: 'teknisyen',
        aktif: false,
      })

      // Email confirmation kapalıyken Supabase otomatik session açar.
      // Pasif kullanıcı direkt login olmamalı — kayıt sonrası hemen çıkış yap.
      await supabase.auth.signOut()
    }

    return { data, error }
  }

  // Teknisyen rolü sadece 08:00 - 20:00 arası login olabilir
  const saatKisitiKontrol = (rol) => {
    if (rol !== 'teknisyen') return true
    const simdi = new Date()
    const saat = simdi.getHours()
    return saat >= 8 && saat < 20
  }

  const signIn = async (kullaniciAdi, password) => {
    kullaniciAdi = kullaniciAdi.toLowerCase().trim()
    const isEmail = kullaniciAdi.includes('@')

    let email = kullaniciAdi

    if (!isEmail) {
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('email, aktif, rol')
        .eq('kullanici_adi', kullaniciAdi)
        .single()

      if (profileError || !prof) {
        return { error: { message: 'Kullanıcı bulunamadı.' } }
      }
      if (!prof.aktif) {
        return { error: { message: 'Hesabınız henüz aktif edilmedi. Yöneticinizle iletişime geçin.' } }
      }
      if (!saatKisitiKontrol(prof.rol)) {
        return { error: { message: 'Teknisyen hesapları sadece 08:00 - 20:00 saatleri arasında giriş yapabilir.' } }
      }
      email = prof.email
    }

    const result = await supabase.auth.signInWithPassword({ email, password })

    // Email ile giriş durumunda da aktif + saat kontrolü yap
    if (!result.error && isEmail) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('aktif, rol')
        .eq('email', email)
        .single()
      if (prof && !prof.aktif) {
        await supabase.auth.signOut()
        return { error: { message: 'Hesabınız henüz aktif edilmedi. Yöneticinizle iletişime geçin.' } }
      }
      if (prof && !saatKisitiKontrol(prof.rol)) {
        await supabase.auth.signOut()
        return { error: { message: 'Teknisyen hesapları sadece 08:00 - 20:00 saatleri arasında giriş yapabilir.' } }
      }
    }

    return result
  }

  const signOut = () => supabase.auth.signOut()

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

  const isAdmin = profile?.rol === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, supabase, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
