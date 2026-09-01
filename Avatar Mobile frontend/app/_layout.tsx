import { Stack } from "expo-router";

export default function RootLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="teacher-dashboard" />
            <Stack.Screen name="parent-dashboard" />
            <Stack.Screen name="student/[id]" />
            <Stack.Screen name="lesson/[id]" />
            <Stack.Screen
                name="modal"
                options={{ presentation: "modal", headerShown: true, title: "Modal" }}
            />
        </Stack>
    );
}
