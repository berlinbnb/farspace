<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1VQ2PnEujbuhNkQ4w88KQtuN1OKHtyo8Z

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables:
   - Frontend: create [.env.local](.env.local) and set `GEMINI_API_KEY` and (opsiyonel) `VITE_ALLOW_MOCK_SIGNIN=true` yalnızca geliştirme amaçlı kullanın.
   - Backend: create [backend/.env](backend/.env) and set `NEYNAR_API_KEY`, `JWT_SECRET`, and optionally `ALLOW_MOCK_SIGNATURES=true` if you want to allow mock logins while testing locally.
3. Start the backend server (geliştirmede mock imza kabul etmek için `ALLOW_MOCK_SIGNATURES=true` olmalı):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend, oda bilgilerini `backend/storage/rooms.json` dosyasında saklayarak yeniden başlatmalarda durumu korur.
4. Run the frontend app:
   ```bash
   npm run dev
   ```

## Farcaster Mini App yayını

Uygulamayı Farcaster Mini Apps Marketplace üzerinde yayınlamak için [resmi rehberdeki](https://miniapps.farcaster.xyz/docs/guides/publishing) adımları takip ederken projede yapmanız gerekenler:

1. **Manifeste erişim** – Uygulama build edildiğinde `manifest.json` dosyası `https://<host>/manifest.json` adresinden servis edilmelidir. Vite zaten kök dizindeki dosyayı kopyalar; production dağıtımınızda statik olarak sunulduğundan emin olun.
2. **Mini app metadata** – `metadata.json` ve `manifest.json` dosyalarındaki alanları final domain ve görsellerle güncelleyin. Özellikle `dapp_url`, `details_url`, `image_url` ve `icon_url` değerlerini canlı ortama göre düzenleyin.
3. **Backend URL’leri** – Backend’iniz HTTPS üzerinden erişilebilir olmalı ve `backend/server.js` içinde `API_BASE_URL` (`services/farcasterService.ts`) ile WebSocket adreslerini production alan adınıza güncelleyin.
4. **Neynar kayıt** – Neynar Mini Apps portalında yeni uygulama kaydı açın, `manifest.json` URL’inizi gönderin ve gerekli doğrulamayı tamamlayın. Aynı portal üzerinden API anahtarınızı üretip `.env` dosyanızda kullanmayı unutmayın.
5. **Dağıtımdan sonra test** – Mini app’i yayınlamadan önce Farcaster istemcisi içinde canlı alan üzerinde oturum açma, kilitli oda daveti ve ses özelliklerini test edin.

Bu adımları tamamladıktan sonra Neynar panelinden yayınlama isteğini gönderebilir ve uygulamanızı Farcaster kullanıcılarına açabilirsiniz.
