export default function Banks() {
  const banks = [
    { name: 'Bancolombia', country: 'CO' },
    { name: 'BBVA', country: 'MX' },
    { name: 'Santander', country: 'MX' },
    { name: 'Banco de Chile', country: 'CL' },
    { name: 'BCP', country: 'PE' },
    { name: 'Itaú', country: 'BR' },
    { name: 'Nubank', country: 'BR' },
    { name: 'Mercado Pago', country: 'LATAM' },
  ]

  return (
    <section className="py-32 px-6 bg-[--color-bg-secondary]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <span className="label text-[--color-accent]">Conexión segura</span>
            <h2 className="font-display text-4xl md:text-5xl text-[--color-text] mt-4">
              Conecta tus cuentas
              <br />
              <span className="text-gradient">en segundos</span>
            </h2>
            <p className="text-lg text-[--color-text-muted] mt-6">
              Integración segura con los principales bancos de Latinoamérica. Tu información siempre encriptada y bajo tu control.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-10">
              <div>
                <p className="stat-number text-4xl">500+</p>
                <p className="text-sm text-[--color-text-muted] mt-1">Instituciones</p>
              </div>
              <div>
                <p className="stat-number text-4xl">256</p>
                <p className="text-sm text-[--color-text-muted] mt-1">Bit encryption</p>
              </div>
              <div>
                <p className="stat-number text-4xl">0</p>
                <p className="text-sm text-[--color-text-muted] mt-1">Data vendida</p>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 mt-10">
              <div className="flex items-center gap-2 text-sm text-[--color-text-dim]">
                <svg className="w-5 h-5 text-[--color-positive]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Solo lectura
              </div>
              <div className="flex items-center gap-2 text-sm text-[--color-text-dim]">
                <svg className="w-5 h-5 text-[--color-positive]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin acceso a contraseñas
              </div>
            </div>
          </div>

          {/* Right: Bank logos */}
          <div className="relative">
            <div className="absolute inset-0 glow-accent opacity-30" />
            <div className="relative glass p-8 md:p-12">
              <p className="text-center text-sm text-[--color-text-muted] mb-8">
                Compatible con más de 500 instituciones en LATAM
              </p>
              <div className="grid grid-cols-4 gap-4">
                {banks.map((bank, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-xl bg-[--color-surface] border border-[--color-border] flex flex-col items-center justify-center p-3 hover:border-[--color-accent]/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[--color-bg-tertiary] flex items-center justify-center mb-2">
                      <span className="text-lg font-bold text-[--color-text-muted]">
                        {bank.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs text-[--color-text-muted] text-center truncate w-full">
                      {bank.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-[--color-text-dim] mt-6">
                México • Colombia • Chile • Perú • Brasil • Argentina
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
