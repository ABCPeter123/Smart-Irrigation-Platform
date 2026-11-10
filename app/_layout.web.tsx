import { Stack } from "expo-router";
import { SiteProvider } from "../src/context/SiteContext";

export default function WebLayout() {
  return (
    <SiteProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SiteProvider>
  );
}
