import Head from "next/head";
import "../styles/globals.css";
import CookieConsent from "../components/CookieConsent";
import MobileInputFocusFix from "../components/MobileInputFocusFix";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </Head>

      <MobileInputFocusFix />

      <Component {...pageProps} />
      <CookieConsent />
    </>
  );
}
