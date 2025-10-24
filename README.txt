
FaceDoor PWA v2 - README
------------------------

Melhorias nesta versão (v2):
- Caminhos relativos para garantir start_url acessível
- manifest.json completo (scope, id, categories)
- Service Worker com estratégia network-first fallback-to-cache
- Icons multi-resolução incluídos (72..512) para compatibilidade PWABuilder
- PWA install prompt tratado no app.js
- WebSocket first, HTTP fallback automático
- Instruções para models do face-api.js

O projeto roda offline para reconhecimento (face-api.js local), mas os modelos devem ser baixados
separadamente e colocados na pasta ./models/

Para gerar APK no PWABuilder:
1. Faça o upload do conteúdo (descompactado) ou do ZIP (FaceDoorPWA_v2.zip) em https://www.pwabuilder.com/package/android
2. Se necessário, ajuste icons em /assets/icons/ e reenvie.
