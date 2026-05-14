import "./globals.css";
import ErrorBoundary from "../components/ErrorBoundary";

export const metadata = {
  title: "Ordkobling",
  description: "Norsk ordspill – koble bokstaver og lag ord!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body className="bg-ink">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}