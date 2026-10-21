import axios from "axios";
import { Lock, User as UserIcon } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_URL, useGlobal } from "../../contexts/GlobalContext";
import { setItemAsync } from "../../utils/storage";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setToken, setUser } = useGlobal();

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const loginUrl = `${API_URL}/auth/login`;
      console.log("[TV LOGIN] intentando login", { loginUrl, username });

      const res = await axios.post(loginUrl, {
        username,
        password,
      });

      console.log("[TV LOGIN] respuesta OK", {
        status: res.status,
        hasToken: !!res.data?.token,
        data: res.data,
      });

      if (res.data.token) {
        await setItemAsync("token", res.data.token);
        setToken(res.data.token);
        setUser(res.data.user ?? null);
      } else {
        setError("La API no devolvió un token válido.");
      }
    } catch (err: any) {
      console.log("[TV LOGIN] error de request", {
        code: err.code,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        url: `${API_URL}/auth/login`,
      });

      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 404) {
        setError(
          "El backend no responde o la ruta de login no existe. Revisa la URL de la API.",
        );
        return;
      }

      if (status === 401) {
        setError(apiError || "Usuario o contraseña incorrectos.");
        return;
      }

      if (status === 403) {
        setError(apiError || "Tu cuenta está inactiva o expirada.");
        return;
      }

      if (err.code === "ERR_NETWORK" || !err.response) {
        setError(
          "No se pudo conectar con el servidor. Verifica tu conexión o la URL de la API.",
        );
        return;
      }

      setError(apiError || "Error de conexión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#02050a] flex-row items-center justify-center">
      {/* Background Graphic */}
      <View className="absolute top-0 right-0 w-1/2 h-full opacity-20">
        <View className="w-full h-full bg-cyan-900 rounded-l-full blur-3xl" />
      </View>

      <View className="w-[500px] p-12 bg-white/5 rounded-3xl border border-white/10 items-center">
        <Text className="text-5xl font-black text-white mb-2 tracking-tighter">
          Nuba<Text className="text-cyan-500">TV</Text>
        </Text>
        <Text className="text-white/40 mb-10 text-lg">
          Inicia sesión en tu Smart TV
        </Text>

        {error ? (
          <View className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl mb-6 w-full">
            <Text className="text-red-300 font-bold text-center">{error}</Text>
          </View>
        ) : null}

        <View className="w-full space-y-6">
          <View className="relative mb-6">
            <View className="absolute left-5 top-5 z-10">
              <UserIcon color="rgba(255,255,255,0.4)" size={24} />
            </View>
            <TextInput
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-16 pr-6 text-white text-xl font-bold focus:border-cyan-500 focus:bg-white/10"
              placeholder="Usuario"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="relative mb-8">
            <View className="absolute left-5 top-5 z-10">
              <Lock color="rgba(255,255,255,0.4)" size={24} />
            </View>
            <TextInput
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-16 pr-6 text-white text-xl font-bold focus:border-cyan-500 focus:bg-white/10"
              placeholder="Contraseña"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="w-full bg-cyan-500 py-5 rounded-2xl flex-row justify-center items-center focus:bg-cyan-400 focus:border-white focus:border-4"
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-black font-black text-2xl uppercase tracking-widest">
                Entrar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
