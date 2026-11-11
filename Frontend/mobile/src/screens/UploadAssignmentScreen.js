import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { validatePickedDocument } from "../utils/fileValidation";
import { ASSIGNMENT_ENDPOINTS } from "../config/api";
import { authenticatedRequest } from "../utils/apiClient";

const ALLOWED_FORMAT_BADGES = ["PDF", "DOCX", "TXT", "JPG", "JPEG", "PNG"];
const MAX_TITLE_LENGTH = 150;
const MAX_COURSE_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

export default function UploadAssignmentScreen({
  onBack,
  onUploadSuccess,
  onUnauthorized,
  onUploadingChange,
}) {
  const [assignmentTitle, setAssignmentTitle] = useState(
    "Neural Networks & Ethics in Modern Machine Learning"
  );
  const [courseSubject, setCourseSubject] = useState(
    "CS 4820: Ethical Artificial Intelligence"
  );
  const [notes] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [isPickingFile, setIsPickingFile] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    if (typeof onUploadingChange === "function") {
      onUploadingChange(isSubmitting);
    }
    return () => {
      if (typeof onUploadingChange === "function") {
        onUploadingChange(false);
      }
    };
  }, [isSubmitting, onUploadingChange]);

  const handleBackPress = () => {
    if (isSubmitting) {
      return;
    }
    if (typeof onBack === "function") {
      onBack();
    }
  };

  const handlePickDocument = async () => {
    if (isPickingFile || isSubmitting) {
      return;
    }

    setIsPickingFile(true);
    setFileError("");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });

      // 1. Handle user canceling the picker cleanly without error
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // 2. Enforce single file selection (take only the first asset)
      const pickedAsset = result.assets[0];

      // 3. Validate file format (PDF, DOCX, TXT, JPG, JPEG, PNG) and max size (10 MB)
      const validation = validatePickedDocument(pickedAsset);

      if (!validation.valid) {
        setFileError(validation.error);
        return;
      }

      // 4. Save valid file metadata (replaces any previously selected file)
      setSelectedFile(validation.file);
      setFileError("");
      setSubmitError("");
    } catch (_error) {
      setFileError(
        "Unable to open the document picker. Please check storage permissions and try again."
      );
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleRemoveFile = () => {
    if (isSubmitting || isPickingFile) {
      return;
    }
    setSelectedFile(null);
    setFileError("");
    setSubmitError("");
    setSubmitSuccess("");
  };

  const handleSubmitAssignment = async () => {
    if (isSubmitting || isPickingFile) {
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");

    const trimmedTitle = assignmentTitle.trim();
    const trimmedCourse = courseSubject.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedTitle) {
      setSubmitError("Assignment title is required.");
      return;
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setSubmitError(
        `Assignment title cannot exceed ${MAX_TITLE_LENGTH} characters.`
      );
      return;
    }

    if (!trimmedCourse) {
      setSubmitError("Course / Subject is required.");
      return;
    }

    if (trimmedCourse.length > MAX_COURSE_LENGTH) {
      setSubmitError(
        `Course / Subject cannot exceed ${MAX_COURSE_LENGTH} characters.`
      );
      return;
    }

    if (trimmedNotes.length > MAX_NOTES_LENGTH) {
      setSubmitError(`Notes cannot exceed ${MAX_NOTES_LENGTH} characters.`);
      return;
    }

    if (!selectedFile || !selectedFile.uri) {
      setSubmitError(
        "Please select a valid assignment file (PDF, DOCX, TXT, JPG, JPEG, or PNG) before submitting."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Build multipart/form-data payload without manually setting Content-Type
      const formData = new FormData();
      formData.append("title", trimmedTitle);
      formData.append("course", trimmedCourse);
      if (trimmedNotes) {
        formData.append("notes", trimmedNotes);
      }
      formData.append("file", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || "application/octet-stream",
      });

      const response = await authenticatedRequest(ASSIGNMENT_ENDPOINTS.UPLOAD, {
        method: "POST",
        body: formData,
        onUnauthorized,
      });

      if (response.status === 201 && response.ok) {
        setSubmitSuccess(
          response.data?.message ||
            "Assignment uploaded and verified successfully! Redirecting to your Papers..."
        );

        await new Promise((resolve) => setTimeout(resolve, 650));

        if (typeof onUploadSuccess === "function") {
          await onUploadSuccess(response.data?.assignment);
        }
        return;
      }

      if (response.status === 401 || response.isUnauthorized) {
        setSubmitError(
          response.data?.message ||
            "Your session has expired. Please sign in again."
        );
        return;
      }

      if (response.status === 403 || response.isForbidden) {
        setSubmitError(
          response.data?.message ||
            "Access denied. Only students are authorized to submit assignments."
        );
        return;
      }

      if (response.status === 413) {
        setSubmitError(
          response.data?.message ||
            "File size exceeds the 10 MB maximum limit per submission."
        );
        return;
      }

      if (response.status === 400) {
        setSubmitError(
          response.data?.message ||
            "Invalid submission details or unsupported file format. Please check your file and try again."
        );
        return;
      }

      if (response.status >= 500) {
        setSubmitError(
          response.data?.message ||
            "Server error while saving your assignment. Please try again shortly."
        );
        return;
      }

      setSubmitError(
        response.data?.message ||
          "Unable to upload assignment. Please verify your network connection and try again."
      );
    } catch (_error) {
      setSubmitError(
        "Unable to connect to the VeriWrite server. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isImageFile =
    selectedFile &&
    (selectedFile.fileType === "JPG" ||
      selectedFile.fileType === "JPEG" ||
      selectedFile.fileType === "PNG");

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back Button + ANALYZE • VERIFY • TRUST Row */}
      <View className="flex-row items-center justify-between mb-3.5">
        <Pressable
          onPress={handleBackPress}
          disabled={isSubmitting}
          className={`w-9 h-9 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center ${
            isSubmitting ? "opacity-50" : "active:opacity-80"
          }`}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={17} color="#94A3B8" />
        </Pressable>

        <View className="flex-row items-center bg-[#112236] border border-[#1B3552] rounded-full px-3 py-1">
          <View
            style={styles.cyanDotGlow}
            className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] mr-2"
          />
          <Text className="text-[9.5px] font-bold tracking-[1.3px] text-[#38BDF8] uppercase">
            ANALYZE • VERIFY • TRUST
          </Text>
        </View>
      </View>

      {/* Screen Heading */}
      <Text className="text-[24px] font-bold text-white tracking-tight mb-1.5">
        Upload Assignment
      </Text>
      <Text className="text-[13px] leading-[19px] text-[#8E96B0] mb-5">
        Submit your work for explainable AI verification and academic integrity
        analysis.
      </Text>

      {/* Field 1: Assignment Title */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[12px] font-semibold text-[#CBD5E1]">
            Assignment Title
          </Text>
          <Text className="text-[11px] font-semibold text-[#38BDF8]">
            Required
          </Text>
        </View>

        <View className="flex-row items-center bg-[#080B16] border border-[#192036] rounded-xl px-3.5 h-[48px]">
          <Ionicons
            name="document-text-outline"
            size={17}
            color="#64748B"
            style={{ marginRight: 10 }}
          />
          <TextInput
            value={assignmentTitle}
            onChangeText={(text) => {
              setAssignmentTitle(text);
              if (submitError) setSubmitError("");
            }}
            editable={!isSubmitting}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Enter assignment title"
            placeholderTextColor="#475569"
            className="flex-1 text-[13.5px] text-[#E2E8F0] py-2"
          />
        </View>
      </View>

      {/* Field 2: Course / Subject */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[12px] font-semibold text-[#CBD5E1]">
            Course / Subject
          </Text>
          <Text className="text-[11px] font-semibold text-[#38BDF8]">
            Required
          </Text>
        </View>

        <View className="flex-row items-center bg-[#080B16] border border-[#192036] rounded-xl px-3.5 h-[48px]">
          <Ionicons
            name="book-outline"
            size={17}
            color="#64748B"
            style={{ marginRight: 10 }}
          />
          <TextInput
            value={courseSubject}
            onChangeText={(text) => {
              setCourseSubject(text);
              if (submitError) setSubmitError("");
            }}
            editable={!isSubmitting}
            maxLength={MAX_COURSE_LENGTH}
            placeholder="Enter course code and subject"
            placeholderTextColor="#475569"
            className="flex-1 text-[13.5px] text-[#E2E8F0] py-2"
          />
        </View>
      </View>

      {/* Assignment File Section Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[12px] font-semibold text-[#CBD5E1]">
          Assignment File
        </Text>
        <Text className="text-[11px] font-semibold text-[#10B981]">
          Cryptographic Pipeline
        </Text>
      </View>

      {/* Large Rounded Upload Card */}
      <View className="bg-[#14192C] border border-[#232B47] rounded-[20px] px-5 py-6 items-center mb-3">
        {/* Highlighted Upload Icon Box */}
        <View
          style={styles.uploadIconGlow}
          className="w-14 h-14 rounded-2xl bg-[#0B1426] border border-[#1B3552] items-center justify-center mb-3.5"
        >
          <Ionicons name="cloud-upload-outline" size={26} color="#38BDF8" />
        </View>

        <Text className="text-[15.5px] font-bold text-white mb-1 text-center">
          Upload Your Assignment
        </Text>

        <Text className="text-[12px] leading-[17px] text-[#8E96B0] text-center mb-4 px-4">
          Drag and drop your file here or browse{"\n"}files
        </Text>

        {/* Browse Device Button */}
        <Pressable
          onPress={handlePickDocument}
          disabled={isPickingFile || isSubmitting}
          className={`bg-[#1F2742] border border-[#2E3A5F] rounded-xl px-4 py-2.5 flex-row items-center justify-center ${
            isPickingFile || isSubmitting ? "opacity-60" : "active:opacity-80"
          }`}
          accessibilityRole="button"
          accessibilityLabel="Browse Device"
        >
          {isPickingFile ? (
            <ActivityIndicator
              size="small"
              color="#38BDF8"
              style={{ marginRight: 7 }}
            />
          ) : (
            <Ionicons
              name="folder-open-outline"
              size={15}
              color="#38BDF8"
              style={{ marginRight: 7 }}
            />
          )}
          <Text className="text-[12.5px] font-bold text-[#E2E8F0]">
            {isPickingFile ? "Opening Picker..." : "Browse Device"}
          </Text>
        </Pressable>
      </View>

      {/* File Validation Error Banner */}
      {fileError ? (
        <View className="bg-[#261219] border border-[#EF4444]/50 rounded-2xl p-3.5 mb-3.5 flex-row items-start">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#F87171"
            style={{ marginTop: 1, marginRight: 9 }}
          />
          <View className="flex-1">
            <Text className="text-[12px] font-bold text-[#FCA5A5] mb-0.5">
              File Selection Error
            </Text>
            <Text className="text-[11.5px] leading-[16px] text-[#FECACA]">
              {fileError}
            </Text>
          </View>
          <Pressable
            onPress={() => setFileError("")}
            hitSlop={8}
            className="ml-2 p-0.5"
            accessibilityRole="button"
            accessibilityLabel="Dismiss file error"
          >
            <Ionicons name="close" size={15} color="#FCA5A5" />
          </Pressable>
        </View>
      ) : null}

      {/* Selected-File Preview Row (Rendered when a valid file is selected) */}
      {selectedFile ? (
        <View className="bg-[#12172A] border border-[#202842] rounded-2xl p-3.5 mb-3.5 flex-row items-center">
          {/* Document / Image Icon Box */}
          <View className="w-10 h-10 rounded-xl bg-[#0A1526] border border-[#16324F] items-center justify-center mr-3">
            <Ionicons
              name={isImageFile ? "image-outline" : "document-text-outline"}
              size={18}
              color="#38BDF8"
            />
          </View>

          {/* Original Filename, File Size in MB & File Type */}
          <View className="flex-1 pr-2">
            <View className="flex-row items-center">
              <Text
                className="text-[13px] font-bold text-white shrink mr-1.5"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedFile.name}
              </Text>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#10B981"
              />
            </View>

            <View className="flex-row items-center flex-wrap mt-0.5">
              <Text className="text-[11px] font-semibold text-[#38BDF8]">
                {selectedFile.fileType}
              </Text>
              <Text className="text-[11px] text-[#64748B] mx-1.5">•</Text>
              <Text className="text-[11px] text-[#8E96B0]">
                {selectedFile.sizeFormatted}
              </Text>
              <Text className="text-[11px] text-[#64748B] mx-1.5">•</Text>
              <Text className="text-[11px] font-semibold text-[#10B981]">
                {isSubmitting ? "Uploading securely..." : "Ready to analyze"}
              </Text>
            </View>
          </View>

          {/* Replace & Remove Actions */}
          <View className="flex-row items-center">
            <Pressable
              onPress={handlePickDocument}
              disabled={isPickingFile || isSubmitting}
              className={`bg-[#0B1528] border border-[#193052] rounded-lg px-2.5 py-1.5 mr-2 ${
                isPickingFile || isSubmitting ? "opacity-50" : "active:opacity-80"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Replace selected file"
            >
              <Text className="text-[11px] font-bold text-[#38BDF8]">
                Replace
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRemoveFile}
              disabled={isPickingFile || isSubmitting}
              className={`w-8 h-8 rounded-lg bg-[#1A1F35] border border-[#262E4D] items-center justify-center ${
                isPickingFile || isSubmitting ? "opacity-50" : "active:opacity-80"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Remove selected file"
            >
              <Ionicons name="trash-outline" size={15} color="#94A3B8" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Upload / API Submission Error Banner */}
      {submitError ? (
        <View className="bg-[#261219] border border-[#EF4444]/50 rounded-2xl p-3.5 mb-3.5 flex-row items-start">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#F87171"
            style={{ marginTop: 1, marginRight: 9 }}
          />
          <View className="flex-1">
            <Text className="text-[12px] font-bold text-[#FCA5A5] mb-0.5">
              Submission Error
            </Text>
            <Text className="text-[11.5px] leading-[16px] text-[#FECACA]">
              {submitError}
            </Text>
          </View>
          <Pressable
            onPress={() => setSubmitError("")}
            hitSlop={8}
            className="ml-2 p-0.5"
            accessibilityRole="button"
            accessibilityLabel="Dismiss submission error"
          >
            <Ionicons name="close" size={15} color="#FCA5A5" />
          </Pressable>
        </View>
      ) : null}

      {/* Upload Success Confirmation Banner */}
      {submitSuccess ? (
        <View className="bg-[#0B2220] border border-[#10B981]/50 rounded-2xl p-3.5 mb-3.5 flex-row items-start">
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color="#34D399"
            style={{ marginTop: 1, marginRight: 9 }}
          />
          <View className="flex-1">
            <Text className="text-[12px] font-bold text-[#6EE7B7] mb-0.5">
              Upload Complete
            </Text>
            <Text className="text-[11.5px] leading-[16px] text-[#A7F3D0]">
              {submitSuccess}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Allowed Formats Card */}
      <View className="bg-[#0B0E1B] border border-[#192036] rounded-[18px] p-4 mb-5">
        <View className="flex-row items-center justify-between mb-2.5">
          <Text className="text-[10.5px] font-bold tracking-[0.8px] text-[#94A3B8] uppercase">
            ALLOWED FORMATS
          </Text>
          <Text className="text-[11px] font-semibold text-[#94A3B8]">
            Max: 10 MB
          </Text>
        </View>

        {/* Format Badges */}
        <View className="flex-row flex-wrap mb-3">
          {ALLOWED_FORMAT_BADGES.map((format) => (
            <View
              key={format}
              className="bg-[#161C30] border border-[#242D4A] rounded-md px-2.5 py-1 mr-1.5 mb-1.5"
            >
              <Text className="text-[10.5px] font-bold text-[#CBD5E1]">
                {format}
              </Text>
            </View>
          ))}
        </View>

        {/* Maximum File Size Note */}
        <View className="flex-row items-start">
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#38BDF8"
            style={{ marginTop: 1, marginRight: 7 }}
          />
          <Text className="flex-1 text-[11.5px] leading-[16px] text-[#64748B]">
            Maximum file size: 10 MB per individual submission.
          </Text>
        </View>
      </View>

      {/* Submit Assignment Gradient Button */}
      <Pressable
        onPress={handleSubmitAssignment}
        disabled={isSubmitting || isPickingFile}
        style={styles.submitGlow}
        className={`w-full ${
          isSubmitting || isPickingFile ? "opacity-75" : "active:opacity-90"
        }`}
        accessibilityRole="button"
        accessibilityLabel="Submit Assignment"
      >
        <LinearGradient
          colors={["#6366F1", "#3B82F6", "#22D3EE"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.submitGradient}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={{ marginRight: 9 }}
              />
              <Text className="text-white font-bold text-[15px]">
                Uploading Assignment...
              </Text>
            </>
          ) : (
            <>
              <Text className="text-white font-bold text-[15px] mr-2">
                Submit Assignment
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </>
          )}
        </LinearGradient>
      </Pressable>

      {/* Security Footer */}
      <View className="flex-row items-center justify-center mt-4 px-2">
        <Ionicons
          name="lock-closed-outline"
          size={13}
          color="#10B981"
          style={{ marginRight: 7 }}
        />
        <Text className="text-[9.5px] font-bold tracking-[1.1px] text-[#64748B] text-center uppercase leading-[14px]">
          256-BIT FORENSIC INTEGRITY GUARANTEED •{"\n"}ANALYZE • VERIFY • TRUST
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 28,
  },
  cyanDotGlow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  uploadIconGlow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  submitGlow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  submitGradient: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
});
