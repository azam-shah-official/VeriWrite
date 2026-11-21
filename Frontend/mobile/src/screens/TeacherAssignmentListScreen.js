import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchTeacherAssignments,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
  fetchMySubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../utils/apiClient";

export default function TeacherAssignmentListScreen({ onBack }) {
  const [subTab, setSubTab] = useState("assignments"); // "assignments" | "subjects"

  // Assignments state
  const [assignments, setAssignments] = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState(null);

  // Subjects state
  const [subjects, setSubjects] = useState([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [subjectError, setSubjectError] = useState(null);

  // Create Assignment Modal
  const [isCreateAssignmentModalVisible, setIsCreateAssignmentModalVisible] =
    useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  // Add Subject Modal
  const [isAddSubjectModalVisible, setIsAddSubjectModalVisible] =
    useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectDesc, setNewSubjectDesc] = useState("");
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Edit Subject Modal State
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] =
    useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectCode, setEditSubjectCode] = useState("");
  const [editSubjectDesc, setEditSubjectDesc] = useState("");
  const [isUpdatingSubject, setIsUpdatingSubject] = useState(false);

  // Edit Assignment Modal State
  const [isEditAssignmentModalVisible, setIsEditAssignmentModalVisible] =
    useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);

  const loadAssignments = useCallback(async () => {
    setIsLoadingAssignments(true);
    setAssignmentError(null);
    try {
      const response = await fetchTeacherAssignments();
      if (response.ok && response.data?.success) {
        setAssignments(response.data.assignments || []);
      } else {
        setAssignmentError(
          response.data?.message || "Failed to load assignments."
        );
      }
    } catch (_err) {
      setAssignmentError("Network error while connecting to server.");
    } finally {
      setIsLoadingAssignments(false);
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    setIsLoadingSubjects(true);
    setSubjectError(null);
    try {
      const response = await fetchMySubjects();
      if (response.ok && response.data?.success) {
        setSubjects(response.data.subjects || []);
        if (response.data.subjects?.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(response.data.subjects[0].id);
        }
      } else {
        setSubjectError(
          response.data?.message || "Failed to load subjects."
        );
      }
    } catch (_err) {
      setSubjectError("Network error while loading subjects.");
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    loadAssignments();
    loadSubjects();
  }, [loadAssignments, loadSubjects]);

  const handleCreateAssignment = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Missing Title", "Please provide an assignment title.");
      return;
    }
    const activeSubjectId =
      selectedSubjectId ||
      (subjects.length > 0 ? subjects[0].id || subjects[0]._id : "");

    if (!activeSubjectId) {
      Alert.alert(
        "Subject Required",
        "Please select or add a subject first before creating an assignment."
      );
      return;
    }

    setIsSavingAssignment(true);
    try {
      const response = await createTeacherAssignment({
        title: newTitle.trim(),
        description: newDescription.trim(),
        subjectId: activeSubjectId,
        deadline: newDeadline.trim() || null,
      });

      if (response.ok && response.data?.success) {
        Alert.alert("Success", "Assignment instruction created successfully.");
        setNewTitle("");
        setNewDescription("");
        setNewDeadline("");
        setIsCreateAssignmentModalVisible(false);
        loadAssignments();
      } else {
        Alert.alert(
          "Creation Failed",
          response.data?.message || "Could not create assignment."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while creating assignment.");
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleOpenEditModal = (item) => {
    if (!item) return;
    setEditingAssignmentId(item.id);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setEditSubjectId(item.subjectId || selectedSubjectId || "");
    setEditDeadline(
      item.deadline ? new Date(item.deadline).toISOString().split("T")[0] : ""
    );
    setEditStatus(item.status || "Active");
    setIsEditAssignmentModalVisible(true);
  };

  const handleSaveEditAssignment = async () => {
    if (!editTitle.trim()) {
      Alert.alert("Missing Title", "Please provide an assignment title.");
      return;
    }
    const targetSubjectId =
      editSubjectId ||
      selectedSubjectId ||
      (subjects.length > 0 ? subjects[0].id || subjects[0]._id : "");

    if (!targetSubjectId) {
      Alert.alert("Subject Required", "Please select a valid subject.");
      return;
    }

    setIsUpdatingAssignment(true);
    try {
      const response = await updateTeacherAssignment(editingAssignmentId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        subjectId: targetSubjectId,
        deadline: editDeadline.trim() || null,
        status: editStatus,
      });

      if (response.ok && response.data?.success) {
        Alert.alert("Success", "Assignment instruction updated successfully.");
        setIsEditAssignmentModalVisible(false);
        setEditingAssignmentId(null);
        loadAssignments();
      } else {
        Alert.alert(
          "Update Failed",
          response.data?.message || "Could not update assignment."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while updating assignment.");
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  const handleDeleteAssignment = (id, title) => {
    Alert.alert(
      "Delete Assignment",
      `Are you sure you want to delete "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteTeacherAssignment(id);
              if (res.ok) {
                loadAssignments();
              } else {
                Alert.alert("Error", res.data?.message || "Could not delete assignment.");
              }
            } catch (_e) {
              Alert.alert("Error", "Network error.");
            }
          },
        },
      ]
    );
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) {
      Alert.alert("Missing Name", "Please provide a subject name.");
      return;
    }

    setIsSavingSubject(true);
    try {
      const response = await createSubject({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim(),
        description: newSubjectDesc.trim(),
      });

      if (response.ok && response.data?.success) {
        Alert.alert("Success", "Subject added to your curriculum.");
        const createdId =
          response.data?.subject?.id || response.data?.subject?._id;
        if (createdId) {
          setSelectedSubjectId(createdId);
        }
        setNewSubjectName("");
        setNewSubjectCode("");
        setNewSubjectDesc("");
        setIsAddSubjectModalVisible(false);
        loadSubjects();
      } else {
        Alert.alert(
          "Could Not Add Subject",
          response.data?.message || "Duplicate or invalid subject."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while adding subject.");
    } finally {
      setIsSavingSubject(false);
    }
  };

  const handleOpenEditSubjectModal = (subject) => {
    setEditingSubjectId(subject.id);
    setEditSubjectName(subject.name || "");
    setEditSubjectCode(subject.code || "");
    setEditSubjectDesc(subject.description || "");
    setIsEditSubjectModalVisible(true);
  };

  const handleUpdateSubject = async () => {
    if (!editSubjectName.trim()) {
      Alert.alert("Missing Name", "Please provide a subject name.");
      return;
    }

    setIsUpdatingSubject(true);
    try {
      const response = await updateSubject(editingSubjectId, {
        name: editSubjectName.trim(),
        code: editSubjectCode.trim(),
        description: editSubjectDesc.trim(),
      });

      if (response.ok && response.data?.success) {
        Alert.alert("Success", "Subject updated successfully.");
        const updated = response.data.subject;
        if (updated) {
          setSubjects((prev) =>
            prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
          );
        }
        setIsEditSubjectModalVisible(false);
        setEditingSubjectId(null);
        setEditSubjectName("");
        setEditSubjectCode("");
        setEditSubjectDesc("");
        loadSubjects();
      } else {
        Alert.alert(
          "Could Not Update Subject",
          response.data?.message || "Duplicate or invalid subject."
        );
      }
    } catch (_err) {
      Alert.alert("Error", "Network error while updating subject.");
    } finally {
      setIsUpdatingSubject(false);
    }
  };

  const handleDeleteSubject = (id, name) => {
    Alert.alert(
      "Remove Subject",
      `Are you sure you want to remove "${name}" from your curriculum?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteSubject(id);
              if (res.ok) {
                loadSubjects();
              } else {
                Alert.alert("Error", res.data?.message || "Could not remove subject.");
              }
            } catch (_e) {
              Alert.alert("Error", "Network error.");
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#080B14]">
      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3 border-b border-[#14192C]">
        <View className="flex-row items-center">
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              className="w-8 h-8 rounded-xl bg-[#14192C] border border-[#222943] items-center justify-center mr-3 active:opacity-75"
            >
              <Ionicons name="arrow-back" size={17} color="#94A3B8" />
            </Pressable>
          ) : null}
          <View>
            <Text className="text-[15px] font-bold text-white">
              Curriculum & Assignments
            </Text>
            <Text className="text-[11px] text-[#8E96B0]">
              Faculty Academic Management
            </Text>
          </View>
        </View>

        {subTab === "assignments" ? (
          <Pressable
            onPress={() => setIsCreateAssignmentModalVisible(true)}
            className="bg-[#0284C7] rounded-xl px-3 py-1.5 flex-row items-center active:opacity-85"
          >
            <Ionicons name="add" size={15} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text className="text-[11.5px] font-bold text-white">New Task</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setIsAddSubjectModalVisible(true)}
            className="bg-[#0284C7] rounded-xl px-3 py-1.5 flex-row items-center active:opacity-85"
          >
            <Ionicons name="add" size={15} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text className="text-[11.5px] font-bold text-white">Add Subject</Text>
          </Pressable>
        )}
      </View>

      {/* Sub Tabs */}
      <View className="flex-row px-5 pt-3 pb-2">
        <Pressable
          onPress={() => setSubTab("assignments")}
          className={`mr-3 pb-2 border-b-2 ${
            subTab === "assignments" ? "border-[#38BDF8]" : "border-transparent"
          }`}
        >
          <Text
            className={`text-[13px] font-bold ${
              subTab === "assignments" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            Created Assignments ({assignments.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSubTab("subjects")}
          className={`pb-2 border-b-2 ${
            subTab === "subjects" ? "border-[#38BDF8]" : "border-transparent"
          }`}
        >
          <Text
            className={`text-[13px] font-bold ${
              subTab === "subjects" ? "text-[#38BDF8]" : "text-[#64748B]"
            }`}
          >
            My Subjects ({subjects.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5 pt-2" showsVerticalScrollIndicator={false}>
        {subTab === "assignments" ? (
          /* Created Assignments View */
          isLoadingAssignments ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text className="text-[12px] text-[#8E96B0] mt-2">
                Loading created assignments...
              </Text>
            </View>
          ) : assignmentError ? (
            <View className="bg-[#2B1417] border border-[#522229] rounded-2xl p-4 my-2">
              <Text className="text-[12px] text-[#F87171]">{assignmentError}</Text>
              <Pressable
                onPress={loadAssignments}
                className="mt-2 bg-[#3D1A1F] rounded-lg py-1 px-3 self-start"
              >
                <Text className="text-[11px] font-bold text-white">Retry</Text>
              </Pressable>
            </View>
          ) : assignments.length === 0 ? (
            <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-8 items-center my-4">
              <Ionicons name="document-outline" size={32} color="#64748B" />
              <Text className="text-[14px] font-bold text-white mt-2 mb-1">
                No Created Assignments
              </Text>
              <Text className="text-[12px] text-[#8E96B0] text-center mb-4">
                You have not created any assignment instructions yet. Tap "New Task" to create one.
              </Text>
              <Pressable
                onPress={() => setIsCreateAssignmentModalVisible(true)}
                className="bg-[#0284C7] rounded-xl px-4 py-2"
              >
                <Text className="text-[12px] font-bold text-white">
                  Create Assignment Instruction
                </Text>
              </Pressable>
            </View>
          ) : (
            assignments.map((item) => (
              <View
                key={`ta-${item.id}`}
                className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3"
              >
                <View className="flex-row items-start justify-between mb-1.5">
                  <View className="flex-1 mr-2">
                    <Text className="text-[14px] font-bold text-white mb-0.5">
                      {item.title}
                    </Text>
                    <View className="flex-row items-center">
                      <View className="bg-[#0C243B] border border-[#194D7C] rounded px-1.5 py-0.2 mr-2">
                        <Text className="text-[9.5px] font-bold text-[#38BDF8]">
                          {item.subjectName}
                        </Text>
                      </View>
                      {item.subjectCode ? (
                        <Text className="text-[10px] text-[#64748B] mr-2">
                          {item.subjectCode}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => handleOpenEditModal(item)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit Assignment"
                      className="w-7 h-7 rounded-lg bg-[#0C243B] border border-[#194D7C] items-center justify-center active:opacity-75 mr-2"
                    >
                      <Ionicons name="create-outline" size={13} color="#38BDF8" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteAssignment(item.id, item.title)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Delete Assignment"
                      className="w-7 h-7 rounded-lg bg-[#2B1417] border border-[#522229] items-center justify-center active:opacity-75"
                    >
                      <Ionicons name="trash-outline" size={13} color="#F87171" />
                    </Pressable>
                  </View>
                </View>

                {item.description ? (
                  <Text
                    className="text-[11.5px] text-[#8E96B0] leading-[16px] mb-2"
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                ) : null}

                <View className="flex-row items-center justify-between pt-2 border-t border-[#182038]">
                  <Text className="text-[10px] text-[#64748B]">
                    Created: {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                  {item.deadline ? (
                    <Text className="text-[10px] font-bold text-[#FBBF24]">
                      Due: {new Date(item.deadline).toLocaleDateString()}
                    </Text>
                  ) : (
                    <Text className="text-[10px] text-[#64748B]">No Deadline</Text>
                  )}
                </View>
              </View>
            ))
          )
        ) : (
          /* My Subjects View */
          isLoadingSubjects ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text className="text-[12px] text-[#8E96B0] mt-2">
                Loading subjects...
              </Text>
            </View>
          ) : subjectError ? (
            <View className="bg-[#2B1417] border border-[#522229] rounded-2xl p-4 my-2">
              <Text className="text-[12px] text-[#F87171]">{subjectError}</Text>
              <Pressable
                onPress={loadSubjects}
                className="mt-2 bg-[#3D1A1F] rounded-lg py-1 px-3 self-start"
              >
                <Text className="text-[11px] font-bold text-white">Retry</Text>
              </Pressable>
            </View>
          ) : subjects.length === 0 ? (
            <View className="bg-[#101426] border border-[#202948] rounded-[20px] p-8 items-center my-4">
              <Ionicons name="book-outline" size={32} color="#64748B" />
              <Text className="text-[14px] font-bold text-white mt-2 mb-1">
                No Subjects Configured
              </Text>
              <Text className="text-[12px] text-[#8E96B0] text-center mb-4">
                Add the subjects you teach so your students can select them during assignment uploads.
              </Text>
              <Pressable
                onPress={() => setIsAddSubjectModalVisible(true)}
                className="bg-[#0284C7] rounded-xl px-4 py-2"
              >
                <Text className="text-[12px] font-bold text-white">Add Subject</Text>
              </Pressable>
            </View>
          ) : (
            subjects.map((sub) => (
              <View
                key={`subj-${sub.id}`}
                className="bg-[#101426] border border-[#202948] rounded-[20px] p-4 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center mb-0.5">
                    <Text className="text-[13.5px] font-bold text-white mr-2">
                      {sub.name}
                    </Text>
                    {sub.code ? (
                      <View className="bg-[#0C243B] border border-[#194D7C] rounded px-1.5 py-0.2">
                        <Text className="text-[9.5px] font-bold text-[#38BDF8]">
                          {sub.code}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {sub.description ? (
                    <Text className="text-[11px] text-[#8E96B0]" numberOfLines={1}>
                      {sub.description}
                    </Text>
                  ) : null}
                </View>

                <View className="flex-row items-center">
                  <Pressable
                    onPress={() => handleOpenEditSubjectModal(sub)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${sub.name}`}
                    className="w-7 h-7 rounded-lg bg-[#0C243B] border border-[#194D7C] items-center justify-center active:opacity-75 mr-2"
                  >
                    <Ionicons name="create-outline" size={13} color="#38BDF8" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteSubject(sub.id, sub.name)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${sub.name}`}
                    className="w-7 h-7 rounded-lg bg-[#2B1417] border border-[#522229] items-center justify-center active:opacity-75"
                  >
                    <Ionicons name="trash-outline" size={13} color="#F87171" />
                  </Pressable>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Modal: Create Assignment */}
      <Modal
        visible={isCreateAssignmentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCreateAssignmentModalVisible(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-[#101426] border-t border-[#202948] rounded-t-[28px] p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[16px] font-bold text-white">
                Create Assignment Task
              </Text>
              <Pressable
                onPress={() => setIsCreateAssignmentModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Title *
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Modern Deep Learning Ethics Essay"
                placeholderTextColor="#475569"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
              />

              {/* Subject Selector */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Subject *
              </Text>
              {subjects.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 max-h-9">
                  {subjects.map((s) => {
                    const sId = s.id || s._id;
                    const isSelected = selectedSubjectId === sId;
                    return (
                      <Pressable
                        key={`sel-s-${sId}`}
                        onPress={() => setSelectedSubjectId(sId)}
                        className={`mr-2 px-3 py-1.5 rounded-full border ${
                          isSelected
                            ? "bg-[#1E294B] border-[#38BDF8]"
                            : "bg-[#080B14] border-[#1A233D]"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            isSelected ? "text-[#38BDF8]" : "text-[#8E96B0]"
                          }`}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text className="text-[11.5px] text-[#FBBF24] mb-3">
                  Please add at least one subject in "My Subjects" first.
                </Text>
              )}

              {/* Description */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Instructions / Description
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Describe assignment scope, citation style, and required sections..."
                placeholderTextColor="#475569"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[12.5px] text-white min-h-[70px] mb-3"
                textAlignVertical="top"
              />

              {/* Deadline */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Deadline (Optional)
              </Text>
              <TextInput
                value={newDeadline}
                onChangeText={setNewDeadline}
                placeholder="YYYY-MM-DD (e.g. 2026-12-15)"
                placeholderTextColor="#475569"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-5"
              />

              {/* Submit Button */}
              <Pressable
                disabled={isSavingAssignment}
                onPress={handleCreateAssignment}
                className="w-full h-[46px] bg-[#0284C7] rounded-xl items-center justify-center active:opacity-85 mb-4"
              >
                {isSavingAssignment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-[13.5px] font-bold text-white">
                    Publish Assignment Task
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Subject */}
      <Modal
        visible={isAddSubjectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddSubjectModalVisible(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-[#101426] border-t border-[#202948] rounded-t-[28px] p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[16px] font-bold text-white">Add Subject</Text>
              <Pressable
                onPress={() => setIsAddSubjectModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Subject Name */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Subject Name *
            </Text>
            <TextInput
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="e.g. Computer Science"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
            />

            {/* Course Code */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Course Code (Optional)
            </Text>
            <TextInput
              value={newSubjectCode}
              onChangeText={setNewSubjectCode}
              placeholder="e.g. CS-4820"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
            />

            {/* Description */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Description (Optional)
            </Text>
            <TextInput
              value={newSubjectDesc}
              onChangeText={setNewSubjectDesc}
              placeholder="e.g. Undergraduate artificial intelligence & ethics curriculum"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[12.5px] text-white mb-5"
            />

            {/* Submit Button */}
            <Pressable
              disabled={isSavingSubject}
              onPress={handleCreateSubject}
              className="w-full h-[46px] bg-[#0284C7] rounded-xl items-center justify-center active:opacity-85 mb-4"
            >
              {isSavingSubject ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[13.5px] font-bold text-white">Save Subject</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit Subject */}
      <Modal
        visible={isEditSubjectModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditSubjectModalVisible(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-[#101426] border-t border-[#202948] rounded-t-[28px] p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[16px] font-bold text-white">Edit Subject</Text>
              <Pressable
                onPress={() => setIsEditSubjectModalVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close edit subject modal"
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Subject Name */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Subject Name *
            </Text>
            <TextInput
              value={editSubjectName}
              onChangeText={setEditSubjectName}
              placeholder="e.g. Computer Science"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
            />

            {/* Course Code */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Course Code (Optional)
            </Text>
            <TextInput
              value={editSubjectCode}
              onChangeText={setEditSubjectCode}
              placeholder="e.g. CS-4820"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
            />

            {/* Description */}
            <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
              Description (Optional)
            </Text>
            <TextInput
              value={editSubjectDesc}
              onChangeText={setEditSubjectDesc}
              placeholder="e.g. Undergraduate artificial intelligence & ethics curriculum"
              placeholderTextColor="#475569"
              className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[12.5px] text-white mb-5"
            />

            {/* Submit Button */}
            <Pressable
              disabled={isUpdatingSubject}
              onPress={handleUpdateSubject}
              className="w-full h-[46px] bg-[#0284C7] rounded-xl items-center justify-center active:opacity-85 mb-4"
              accessibilityRole="button"
              accessibilityLabel="Save subject changes"
            >
              {isUpdatingSubject ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[13.5px] font-bold text-white">Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit Assignment */}
      <Modal
        visible={isEditAssignmentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditAssignmentModalVisible(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-[#101426] border-t border-[#202948] rounded-t-[28px] p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[16px] font-bold text-white">
                Edit Assignment Task
              </Text>
              <Pressable
                onPress={() => setIsEditAssignmentModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Title *
              </Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="e.g. Modern Deep Learning Ethics Essay"
                placeholderTextColor="#475569"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-3"
              />

              {/* Subject Selector */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Subject *
              </Text>
              {subjects.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 max-h-9">
                  {subjects.map((s) => {
                    const sId = s.id || s._id;
                    const isSelected = editSubjectId === sId;
                    return (
                      <Pressable
                        key={`edit-sel-s-${sId}`}
                        onPress={() => setEditSubjectId(sId)}
                        className={`mr-2 px-3 py-1.5 rounded-full border ${
                          isSelected
                            ? "bg-[#1E294B] border-[#38BDF8]"
                            : "bg-[#080B14] border-[#1A233D]"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            isSelected ? "text-[#38BDF8]" : "text-[#8E96B0]"
                          }`}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {/* Status Selector */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Status
              </Text>
              <View className="flex-row items-center mb-3">
                {["Active", "Archived", "Draft"].map((st) => {
                  const isSelected = editStatus === st;
                  return (
                    <Pressable
                      key={`st-${st}`}
                      onPress={() => setEditStatus(st)}
                      className={`mr-2 px-3 py-1.5 rounded-full border ${
                        isSelected
                          ? "bg-[#1E294B] border-[#38BDF8]"
                          : "bg-[#080B14] border-[#1A233D]"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          isSelected ? "text-[#38BDF8]" : "text-[#8E96B0]"
                        }`}
                      >
                        {st}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Description */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Instructions / Description
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Assignment guidelines, prompts, formatting instructions..."
                placeholderTextColor="#475569"
                textAlignVertical="top"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[12.5px] text-white min-h-[75px] mb-3"
              />

              {/* Deadline */}
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#8E96B0] uppercase mb-1">
                Due Date (Optional, YYYY-MM-DD)
              </Text>
              <TextInput
                value={editDeadline}
                onChangeText={setEditDeadline}
                placeholder="2026-12-15"
                placeholderTextColor="#475569"
                className="bg-[#080B14] border border-[#1A233D] rounded-xl px-3.5 py-2.5 text-[13px] text-white mb-5"
              />

              {/* Save Button */}
              <Pressable
                disabled={isUpdatingAssignment}
                onPress={handleSaveEditAssignment}
                className="w-full h-[46px] bg-[#0284C7] rounded-xl items-center justify-center active:opacity-85 mb-4"
              >
                {isUpdatingAssignment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-[13.5px] font-bold text-white">Save Changes</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
