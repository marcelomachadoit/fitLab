// O NutriTrack se chamava FitLab. As preferências salvas neste aparelho usavam o prefixo
// antigo: tema, idioma, aviso de recálculo dispensado e — o que mais importa — o contador
// de tentativas de login e o intervalo entre e-mails, que protegem a conta.
//
// Cada chave "fitlab-*" é copiada uma única vez para "nutritrack-*" e a antiga é apagada,
// para ninguém perder nada com a troca de nome. Roda antes de qualquer outro script.
(function migrateLegacyStorage() {
  const ANTIGO = 'fitlab-';
  const NOVO = 'nutritrack-';
  try {
    const antigas = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const chave = localStorage.key(i);
      if (chave && chave.startsWith(ANTIGO)) antigas.push(chave);
    }
    antigas.forEach((chave) => {
      const nova = NOVO + chave.slice(ANTIGO.length);
      // Se já existe valor novo, ele é o mais recente: não sobrescreve.
      if (localStorage.getItem(nova) === null) localStorage.setItem(nova, localStorage.getItem(chave));
      localStorage.removeItem(chave);
    });
  } catch {
    // Navegação privada ou armazenamento bloqueado: não há o que migrar.
  }
}());
