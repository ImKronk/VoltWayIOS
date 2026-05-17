# VoltWay — App iOS (React Native / Expo)

Conversão da app web VoltWay para uma app nativa iOS, construída com **Expo**
para poder ser desenvolvida em Windows e compilada para iOS sem Mac.

> **Estado: Fase 3 de 3 — conversão completa.** Todas as funcionalidades
> da app web foram migradas para iOS.

---

## O que precisas

| Ferramenta | Para quê |
|------------|----------|
| **Node.js 18+** | Já tens (v24) |
| **App "Expo Go"** | Instala no teu iPhone pela App Store — é onde a app corre |
| Ligação à mesma Wi-Fi | O PC e o iPhone têm de estar na mesma rede |

Não precisas de Mac nem de Xcode para a Fase 1.

---

## Como arrancar

```bash
cd C:\Users\Asus\VoltWayRN

# 1. Instalar dependências
npm install

# 2. Alinhar as versões nativas ao teu Expo SDK (passo importante)
npx expo install --fix

# 3. Arrancar
npx expo start
```

Depois do passo 3 aparece um **QR code** no terminal:

- **iPhone:** abre a câmara → aponta ao QR code → abre na Expo Go.
- A app carrega e podes testar tudo ao vivo. Cada vez que o código muda,
  a app recarrega sozinha.

> Se a tua Expo Go for mais recente que o SDK do projeto, corre antes:
> `npx expo install expo@latest && npx expo install --fix`

---

## Funcionalidades — Fase 1

| Ecrã | Estado |
|------|--------|
| 🗺️ Mapa (Apple Maps) + postos reais (OCM) | ✅ |
| 🔍 Pesquisa de destino + cálculo de rota | ✅ |
| 📋 Lista de postos + filtros (todos/disponível/rápido/barato) | ✅ |
| 🔌 Filtro por conector quando há rota ativa | ✅ |
| ⚡ Detalhe do posto (preço, tarifa de referência, conectores) | ✅ |
| 🔋 Planeamento de rota com bateria + paragem ótima | ✅ |
| 🚨 Paragem de emergência (cards visuais novos) | ✅ |

## Funcionalidades — Fase 2

| Ecrã | Estado |
|------|--------|
| 🏆 Leaderboard (top utilizadores, stats, nível) | ✅ |
| 🔮 Predições AI (medidor, previsão horária, cards) | ✅ |
| 🔋 Bateria & Autonomia (gráficos de consumo e condução) | ✅ |
| 👤 Perfil (veículo + preferências) | ✅ |

Os novos ecrãs são acedidos pelo painel inferior do mapa (banner de predição + atalhos).

## Funcionalidades — Fase 3

| Funcionalidade | Estado |
|----------------|--------|
| 🔐 Login / registo / sessão (Supabase Auth) | ✅ |
| ☰ Menu lateral completo (perfil + veículo + navegação) | ✅ |
| 🚗 Editar veículo — guarda no Supabase | ✅ |
| 📢 Painel de comunidade — reportar estado dos postos | ✅ |

**Conversão concluída** — as 3 fases cobrem todos os ecrãs e funcionalidades da app web.

---

## APIs usadas (iguais à versão web)

| API | Função | Chave |
|-----|--------|-------|
| **Apple Maps** | Renderiza o mapa | Nenhuma (nativo iOS) |
| **Open Charge Map** | Postos de carregamento reais | Carregada do Supabase `app_config` |
| **OpenRouteService** | Cálculo de rotas | Carregada do Supabase `app_config` |
| **expo-location** | Geolocalização + geocoding de destinos | Nenhuma |
| **Supabase** | Auth + base de dados + chaves | `src/config/supabase.js` |

A lógica de negócio (filtro de conectores, `findOptimalStop`, paragem de
emergência) foi portada 1:1 de `app.js` para `src/services/` e `src/utils/`.

---

## Estrutura do projeto

```
VoltWayRN/
├── App.js                  Navegação + providers
├── index.js                Entry point
├── src/
│   ├── config/supabase.js  Cliente Supabase
│   ├── theme/theme.js      Cores e tokens de design
│   ├── data/pricing.js     Tarifas de referência PT + postos fallback
│   ├── utils/              haversine, formatação, conectores
│   ├── services/           appConfig, stations (OCM), routing (ORS)
│   ├── state/AppContext.js Estado global da app
│   ├── screens/            MapScreen, StationDetailScreen, RouteScreen
│   └── components/         RouteInfoCard (cards de paragem)
```

---

## Resolução de problemas

| Problema | Solução |
|----------|---------|
| Erro de versões ao arrancar | `npx expo install --fix` |
| Mapa em branco | Confirma que a Expo Go está atualizada |
| Não aparecem postos | Sem rede → usa postos fallback (Paris). Verifica as chaves no Supabase |
| QR code não liga | PC e iPhone na mesma Wi-Fi; tenta `npx expo start --tunnel` |
