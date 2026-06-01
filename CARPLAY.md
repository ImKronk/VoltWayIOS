# CarPlay — setup (Premium)

A projeção CarPlay já está **montada no código** (atrás do `premium`), mas só
ganha vida num **build nativo** com o **entitlement da Apple**. Não corre na
Expo Go — nada aqui afeta o fluxo de testes atual (os _guards_ desligam tudo
quando o módulo nativo não existe).

## O que já está no repo
- `react-native-carplay` instalado.
- `src/services/carplay.js` — templates do carro: **lista de postos** + **mapa**
  (TabBarTemplate). Tudo dentro de `try/catch`; vira no-op sem CarPlay.
- `src/components/CarPlayBridge.js` — ativa/desliga com o `premium`; tocar num
  posto no carro chama `planAndSetRoute` (rota com o posto mais eficiente).
- `plugins/withCarPlay.js` — config plugin: entitlements + cena CarPlay no
  Info.plist (aplicado no prebuild/EAS).
- `app.json` — plugin registado.
- `App.js` — `<CarPlayBridge/>` dentro do `AppProvider`.

## O que falta (passos teus — não dá por código)
1. **Apple Developer Program** ($99/ano).
2. **Pedir o entitlement CarPlay** (aprovação manual da Apple):
   https://developer.apple.com/contact/request/carplay-entitlement/
   - `com.apple.developer.carplay-charging` → lista de postos
   - `com.apple.developer.carplay-maps` → navegação turn-by-turn (muito restrito)
   - Normalmente só te dão **um** tipo — fica com o aprovado em `withCarPlay.js`.
3. **Sair da Expo Go → EAS build** (dev build):
   ```bash
   npm i -g eas-cli
   eas login
   eas build:configure
   eas build --profile development --platform ios
   ```
   O `withCarPlay.js` injeta os entitlements + a cena no prebuild.
4. Instalar o **dev build** no iPhone e ligar ao **CarPlay** (carro ou simulador
   CarPlay do Xcode: *I/O ▸ External Displays ▸ CarPlay*).
5. Ativar **Premium** na app (menu ☰ ▸ Plano Premium) → a cena CarPlay aparece.

## Notas
- Confirma o nome do `UISceneDelegateClassName` em `withCarPlay.js` contra a
  versão de `react-native-carplay` que usares (o setup iOS da lib indica-o).
- Navegação turn-by-turn no CarPlay exige `CPNavigationSession` + entitlement
  `carplay-maps`; o `MapTemplate` aqui é o host — liga a sessão quando tiveres
  a aprovação.
- A **bateria do carro** NÃO vem do CarPlay (é só projeção de ecrã). Para isso
  é preciso uma API de dados do veículo (Smartcar/Enode) — fica para depois.
