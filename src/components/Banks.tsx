export default function Banks() {
  const banks = [
    { name: 'Bancolombia', initial: 'B' },
    { name: 'BBVA', initial: 'B' },
    { name: 'Santander', initial: 'S' },
    { name: 'Banco de Chile', initial: 'B' },
    { name: 'BCP', initial: 'B' },
    { name: 'Itaú', initial: 'I' },
    { name: 'Nubank', initial: 'N' },
    { name: 'Mercado Pago', initial: 'M' },
  ]

  return (
    <section className="py-24 px-6 bg-stone-950">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-stone-800/60 border border-stone-700/50 text-xs uppercase tracking-wider text-stone-400 mb-4">
              Conexión Segura
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-stone-100">
              Conecta tus cuentas
              <br />
              <span className="text-emerald-400 font-serif italic">en segundos</span>
            </h2>
            <p className="text-lg text-stone-400 mt-6 max-w-md">
              Integración segura con los principales bancos de Latinoamérica. Tu información siempre encriptada y bajo tu control.
            </p>

            {/* Stats */}
            <div className="flex gap-12 mt-10">
              <div>
                <p className="font-display text-4xl text-stone-100">500+</p>
                <p className="text-sm text-stone-500 mt-1">Instituciones</p>
              </div>
              <div>
                <p className="font-display text-4xl text-stone-100">256</p>
                <p className="text-sm text-stone-500 mt-1">Bit encryption</p>
              </div>
              <div>
                <p className="font-display text-4xl text-stone-100">0</p>
                <p className="text-sm text-stone-500 mt-1">Data vendida</p>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Solo lectura
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin acceso a contraseñas
              </div>
            </div>
          </div>

          {/* Right: Bank grid */}
          <div className="relative">
            <div className="rounded-2xl bg-stone-900/50 border border-stone-800 p-8">
              <p className="text-center text-sm text-stone-500 mb-6">
                Compatible con más de 500 instituciones en LATAM
              </p>
              <div className="grid grid-cols-4 gap-4">
                {banks.map((bank, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-xl bg-stone-800/50 border border-stone-700/50 flex flex-col items-center justify-center p-3 hover:border-stone-600 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-700/50 flex items-center justify-center mb-2">
                      <span className="text-lg font-bold text-stone-400">
                        {bank.initial}
                      </span>
                    </div>
                    <span className="text-xs text-stone-500 text-center truncate w-full">
                      {bank.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-stone-600 mt-6">
                México • Colombia • Chile • Perú • Brasil • Argentina
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
