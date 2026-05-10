import "./globals.css";

export const metadata = {
  title: "Ordkobling",
  description: "Norsk ordspill – koble bokstaver og lag ord!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body className="bg-[#111]">{children}</body>
    </html>
  );
}