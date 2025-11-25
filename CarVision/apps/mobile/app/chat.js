// apps/mobile/app/chat.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ImageBackground,
  Image,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  LogBox,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { Video } from "expo-av";
import { getHttpBase } from "../lib/httpBase";

import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { chatStyles as styles } from "../styles/chatStyles";
import { showCustomAlert } from "../components/CustomAlert";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Suppress expo-image-picker deprecation warning (MediaTypeOptions -> MediaType)
// The new MediaType API isn't available in expo-image-picker ~17.0.8
LogBox.ignoreLogs([
  "[expo-image-picker] `ImagePicker.MediaTypeOptions` have been deprecated",
]);

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const otherUserId = params.userId;
  const otherUserName = params.userName;

  const [user, setUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const [baseUrl, setBaseUrl] = useState(null);
  const listRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!otherUserId) {
      router.back();
      return;
    }
    loadUser();
    loadMessages();
    loadBaseUrl();
    
    // Poll for new messages every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      loadMessages(false);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [otherUserId]);

  async function loadBaseUrl() {
    try {
      const base = await getHttpBase();
      setBaseUrl(base);
    } catch (e) {
      console.error("Failed to load base URL:", e);
    }
  }

  async function loadUser() {
    const currentUser = await getUser();
    setUser(currentUser);
  }

  async function loadMessages(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      const data = await api.get(`/api/messages/${otherUserId}`);
      if (data?.messages) {
        setMessages(data.messages);
        if (data.otherUser) {
          setOtherUser(data.otherUser);
        }
        // Scroll to bottom
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function pickImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showCustomAlert(t("common.error"), t("chat.permissionDenied"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || "image/jpeg",
          name: result.assets[0].fileName || `image_${Date.now()}.jpg`,
        });
      }
    } catch (e) {
      console.error("Image picker error:", e);
      showCustomAlert(t("common.error"), e.message || t("chat.pickImageError"));
    }
  }

  async function pickVideo() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showCustomAlert(t("common.error"), t("chat.permissionDenied"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || "video/mp4",
          name: result.assets[0].fileName || `video_${Date.now()}.mp4`,
        });
      }
    } catch (e) {
      console.error("Video picker error:", e);
      showCustomAlert(t("common.error"), e.message || t("chat.pickVideoError"));
    }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", 
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
               "application/vnd.ms-excel",
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "text/plain"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile({
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || "application/pdf",
          name: result.assets[0].name,
        });
      }
    } catch (e) {
      console.error("Document picker error:", e);
      showCustomAlert(t("common.error"), e.message || t("chat.pickDocumentError"));
    }
  }

  async function sendMessage() {
    const text = input.trim();
    const hasFile = selectedFile !== null;
    
    if ((!text && !hasFile) || sending || uploading) return;

    if (hasFile) {
      await sendFile(text);
    } else {
      await sendTextMessage(text);
    }
  }

  async function sendTextMessage(text) {
    setSending(true);
    setInput("");

    try {
      const data = await api.post("/api/messages", {
        receiverId: otherUserId,
        content: text,
      });

      if (data?.message) {
        await loadMessages(false);
      }
    } catch (e) {
      console.error("Failed to send message:", e);
      setInput(text);
      showCustomAlert(t("common.error"), e.message || t("chat.sendError"));
    } finally {
      setSending(false);
    }
  }

  async function sendFile(text) {
    setUploading(true);
    const fileToSend = selectedFile;
    setSelectedFile(null);
    setInput("");

    try {
      const base = await getHttpBase();
      const formData = new FormData();
      
      formData.append("receiverId", otherUserId);
      if (text) {
        formData.append("content", text);
      }
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileToSend.uri);
      if (!fileInfo.exists) {
        throw new Error("File not found");
      }

      // Create file object for FormData
      const filename = fileToSend.name || `file_${Date.now()}`;
      const fileType = fileToSend.type || "application/octet-stream";
      
      formData.append("file", {
        uri: fileToSend.uri,
        type: fileType,
        name: filename,
      });

      const data = await api.postFile("/api/messages", formData);

      if (data?.message) {
        await loadMessages(false);
      }
    } catch (e) {
      console.error("Failed to send file:", e);
      setSelectedFile(fileToSend); // Restore file on error
      if (text) setInput(text);
      showCustomAlert(t("common.error"), e.message || t("chat.sendFileError"));
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  async function viewFile(message) {
    if (!message.fileUrl) return;
    
    try {
      const base = baseUrl || await getHttpBase();
      const fullUrl = `${base}${message.fileUrl.startsWith("/") ? "" : "/"}${message.fileUrl}`;
      
      if (message.type === "IMAGE") {
        setViewingFile({ ...message, fullUrl, type: "image" });
      } else if (message.type === "VIDEO") {
        setViewingFile({ ...message, fullUrl, type: "video" });
      } else {
        // For documents, download and open directly
        try {
          const fileName = message.fileName || `document_${Date.now()}`;
          const downloadResult = await FileSystem.downloadAsync(
            fullUrl,
            FileSystem.documentDirectory + fileName
          );
          
          // Try to open with intent launcher (Android) or share (iOS)
          if (Platform.OS === "android") {
            try {
              // Use the file URI directly for Android
              await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                data: downloadResult.uri,
                flags: 1,
                type: message.mimeType || "application/pdf",
              });
            } catch (intentError) {
              // Fallback to sharing if intent fails
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(downloadResult.uri);
              } else {
                showCustomAlert(t("common.error"), t("chat.documentOpenError"));
              }
            }
          } else {
            // iOS - use sharing to open
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(downloadResult.uri);
            } else {
              showCustomAlert(t("chat.document"), downloadResult.uri);
            }
          }
        } catch (e) {
          console.error("Failed to open document:", e);
          showCustomAlert(t("common.error"), e.message || t("chat.viewFileError"));
        }
      }
    } catch (e) {
      console.error("View file error:", e);
      showCustomAlert(t("common.error"), e.message || t("chat.viewFileError"));
    }
  }

  async function deleteMessage(messageId) {
    Alert.alert(
      t("chat.deleteMessage"),
      t("chat.deleteMessageConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const data = await api.del(`/api/messages/${messageId}`);
              if (data?.ok) {
                await loadMessages(false);
                showCustomAlert(t("common.success"), t("chat.messageDeleted"));
              }
            } catch (e) {
              console.error("Failed to delete message:", e);
              showCustomAlert(t("common.error"), e.message || t("chat.deleteError"));
            }
          },
        },
      ]
    );
  }

  async function deleteConversation() {
    Alert.alert(
      t("chat.deleteConversation"),
      t("chat.deleteConversationConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const data = await api.del(`/api/messages/conversation/${otherUserId}`);
              if (data?.ok) {
                showCustomAlert(t("common.success"), t("chat.conversationDeleted"));
                router.back();
              }
            } catch (e) {
              console.error("Failed to delete conversation:", e);
              showCustomAlert(t("common.error"), e.message || t("chat.deleteError"));
            }
          },
        },
      ]
    );
  }


  if (loading && !otherUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.sub, marginTop: 12 }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop",
          }}
          imageStyle={{ opacity: 0.12 }}
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
        />

        <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={[styles.avatar, { backgroundColor: otherUser?.role === "GARAGE" ? "rgba(250,204,21,0.15)" : "rgba(124,140,255,0.15)" }]}>
              <MaterialCommunityIcons
                name={otherUser?.role === "GARAGE" ? "garage" : "account"}
                size={20}
                color={otherUser?.role === "GARAGE" ? C.amber : C.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{otherUserName || otherUser?.name || "User"}</Text>
              <Text style={styles.headerSubtitle}>
                {otherUser?.role === "GARAGE" ? t("chat.garage") : t("chat.client")}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={deleteConversation}
            style={styles.deleteConversationBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={22} color={C.red} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.id;
            return <MessageBubble message={item} isMe={isMe} t={t} baseUrl={baseUrl} onViewFile={viewFile} onDelete={deleteMessage} />;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-outline" size={48} color={C.sub} />
              <Text style={styles.emptyText}>{t("chat.noMessages")}</Text>
            </View>
          }
        />

        {/* Selected File Preview */}
        {selectedFile && (
          <View style={styles.filePreview}>
            <View style={styles.filePreviewContent}>
              <Ionicons 
                name={selectedFile.type.startsWith("image/") ? "image-outline" : 
                      selectedFile.type.startsWith("video/") ? "videocam-outline" : 
                      "document-outline"} 
                size={24} 
                color={C.primary} 
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.filePreviewName} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.filePreviewType}>
                  {selectedFile.type}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                style={styles.filePreviewClose}
              >
                <Ionicons name="close-circle" size={24} color={C.red} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => {
                Alert.alert(
                  t("chat.attachFile"),
                  t("chat.selectFileType"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("chat.photo"), onPress: pickImage },
                    { text: t("chat.video"), onPress: pickVideo },
                    { text: t("chat.document"), onPress: pickDocument },
                  ]
                );
              }}
              disabled={sending || uploading}
            >
              <Ionicons name="attach-outline" size={22} color={C.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={t("chat.typeMessage")}
              placeholderTextColor={C.sub}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, ((!input.trim() && !selectedFile) || sending || uploading) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={(!input.trim() && !selectedFile) || sending || uploading}
            >
              {(sending || uploading) ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* File Viewer Modal */}
        <Modal
          visible={viewingFile !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (videoRef.current) {
              videoRef.current.pauseAsync();
              videoRef.current.unloadAsync();
            }
            setViewingFile(null);
          }}
        >
          <View style={styles.fileViewerModal}>
            <View style={styles.fileViewerHeader}>
              <Text style={styles.fileViewerTitle} numberOfLines={1}>
                {viewingFile?.fileName || t("chat.file")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (videoRef.current) {
                    videoRef.current.pauseAsync();
                    videoRef.current.unloadAsync();
                  }
                  setViewingFile(null);
                }}
                style={styles.fileViewerClose}
              >
                <Ionicons name="close" size={28} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.fileViewerContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              {viewingFile?.type === "image" && (
                <Image
                  source={{ uri: viewingFile.fullUrl }}
                  style={styles.fileViewerImage}
                  resizeMode="contain"
                />
              )}
              {viewingFile?.type === "video" && (
                <View style={styles.fileViewerVideoContainer}>
                  <Video
                    ref={videoRef}
                    source={{ uri: viewingFile.fullUrl }}
                    style={styles.fileViewerVideo}
                    useNativeControls
                    resizeMode="contain"
                    shouldPlay
                    isLooping={false}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
        </SafeAreaView>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

function MessageBubble({ message, isMe, t, baseUrl, onViewFile, onDelete }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasContent = message.content && message.content.trim().length > 0;
  const hasFile = message.fileUrl && message.type !== "TEXT";
  
  const fileUrl = baseUrl && message.fileUrl 
    ? `${baseUrl}${message.fileUrl.startsWith("/") ? "" : "/"}${message.fileUrl}`
    : null;

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const renderRightActions = () => {
    return (
      <View style={styles.swipeActionContainer}>
        <TouchableOpacity
          style={styles.swipeDeleteButton}
          onPress={() => onDelete && onDelete(message.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.swipeDeleteText}>{t("common.delete")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity
        style={[styles.messageRow, isMe && styles.messageRowMe]}
        onLongPress={() => onDelete && onDelete(message.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
          ]}
        >
        {/* File Display */}
        {hasFile && fileUrl && (
          <TouchableOpacity
            style={styles.fileBubble}
            onPress={() => onViewFile(message)}
            activeOpacity={0.8}
          >
            {message.type === "IMAGE" && (
              <Image
                source={{ uri: fileUrl }}
                style={styles.fileImage}
                resizeMode="cover"
              />
            )}
            {message.type === "VIDEO" && (
              <View style={styles.fileVideoContainer}>
                <Ionicons name="videocam" size={32} color={C.primary} />
                <Text style={styles.fileVideoText}>{t("chat.video")}</Text>
              </View>
            )}
            {message.type === "DOCUMENT" && (
              <View style={styles.fileDocumentContainer}>
                <Ionicons name="document" size={32} color={C.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.fileDocumentName} numberOfLines={1}>
                    {message.fileName || t("chat.document")}
                  </Text>
                  {message.fileSize && (
                    <Text style={styles.fileDocumentSize}>
                      {formatFileSize(message.fileSize)}
                    </Text>
                  )}
                </View>
                <Ionicons name="download-outline" size={20} color={C.primary} />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Message Content */}
        {hasContent && (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {message.content}
          </Text>
        )}
        
        {/* Show placeholder if no content and no file */}
        {!hasContent && !hasFile && (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe, { fontStyle: "italic", opacity: 0.6 }]}>
            {t("chat.emptyMessage")}
          </Text>
        )}

        {/* Time */}
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {time}
        </Text>
      </View>
    </TouchableOpacity>
    </Swipeable>
  );
}
