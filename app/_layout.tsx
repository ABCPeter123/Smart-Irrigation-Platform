import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SiteProvider } from "../src/context/SiteContext";

export default function RootLayout() {
  return (
    <SiteProvider>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#1F7AE0",
          tabBarInactiveTintColor: "#6B7A90",
          tabBarStyle: {
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          headerTitleStyle: {
            fontWeight: "700",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="recommendations"
          options={{
            title: "Actions",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flash-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="weather"
          options={{
            title: "Weather",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="partly-sunny-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="sites"
          options={{
            title: "Sites",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="leaf-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="site/[id]"
          options={{
            title: "Site Detail",
            href: null,
            tabBarStyle: {
              display: "none",
            },
          }}
        />
      </Tabs>
    </SiteProvider>
  );
}