import { getChatGPTUser } from "./chatgpt-auth";
import { HorusApp } from "./HorusApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <HorusApp
      user={{
        name: user?.displayName ?? "Marina Costa",
        email: user?.email ?? "marina@acme.com.br",
      }}
    />
  );
}
