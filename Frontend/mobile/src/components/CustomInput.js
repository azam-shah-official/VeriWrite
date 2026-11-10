import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CustomInput({
  label,
  rightLabel,
  iconName,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  showPasswordToggle = false,
  isPasswordVisible = false,
  onTogglePassword,
  keyboardType = "default",
  autoCapitalize = "none",
  error,
}) {
  return (
    <View className="mb-4">
      {/* Label Row */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[12.5px] font-medium text-[#CBD5E1]">
          {label}
        </Text>
        {rightLabel ? (
          <Text className="text-[10.5px] font-semibold tracking-[1px] text-[#64748B] uppercase">
            {rightLabel}
          </Text>
        ) : null}
      </View>

      {/* Input Container */}
      <View
        className={`flex-row items-center bg-[#080A14] rounded-xl px-3.5 h-[50px] border ${
          error ? "border-[#EF4444]" : "border-[#1C2237]"
        }`}
      >
        <Ionicons
          name={iconName}
          size={18}
          color="#94A3B8"
          style={{ marginRight: 10 }}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          className="flex-1 text-[14px] text-[#F8FAFC] py-2"
        />

        {showPasswordToggle && (
          <Pressable
            onPress={onTogglePassword}
            hitSlop={10}
            className="pl-2 py-1"
            accessibilityRole="button"
            accessibilityLabel={
              isPasswordVisible ? "Hide password" : "Show password"
            }
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={19}
              color="#94A3B8"
            />
          </Pressable>
        )}
      </View>

      {/* Validation Error Text */}
      {error ? (
        <Text className="text-[11.5px] text-[#F87171] mt-1.5 ml-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
