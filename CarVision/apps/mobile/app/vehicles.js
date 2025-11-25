// apps/mobile/app/vehicles.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ImageBackground,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { vehiclesStyles as styles } from "../styles/vehiclesStyles";

export default function VehiclesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [garages, setGarages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGaragePicker, setShowGaragePicker] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    vin: "",
    licensePlate: "",
    color: "",
    mileage: "",
    notes: "",
    garageId: "",
    ownerId: "", // For garage to select client
    status: "",
  });
  const [clients, setClients] = useState([]);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Get current user
      const currentUser = await getUser();
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      // Load vehicles
      const data = await api.get("/api/vehicles");
      if (data?.vehicles) {
        setVehicles(data.vehicles);
      }

      // If client, load garages for selection
      if (currentUser.role === "CLIENT") {
        try {
          const garagesData = await api.get("/api/vehicles/garages");
          if (garagesData?.garages) {
            setGarages(garagesData.garages);
          } else {
            setGarages([]);
          }
        } catch (e) {
          console.error("Failed to load garages:", e);
          showCustomAlert(t("common.error"), e.message || t("vehicles.loadGaragesError"));
          setGarages([]);
        }
      }
    } catch (e) {
      console.error("Failed to load vehicles:", e);
      showCustomAlert(t("common.error"), e.message || t("vehicles.loadError"));
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingVehicle(null);
    setFormData({
      make: "",
      model: "",
      year: "",
      vin: "",
      licensePlate: "",
      color: "",
      mileage: "",
      notes: "",
      garageId: "",
      ownerId: "",
      status: "",
    });
    setShowModal(true);
  }

  function openEditModal(vehicle) {
    setEditingVehicle(vehicle);
    setFormData({
      make: vehicle.make || "",
      model: vehicle.model || "",
      year: vehicle.year?.toString() || "",
      vin: vehicle.vin || "",
      licensePlate: vehicle.licensePlate || "",
      color: vehicle.color || "",
      mileage: vehicle.mileage?.toString() || "",
      notes: vehicle.notes || "",
      garageId: vehicle.garageId || "",
      ownerId: vehicle.ownerId || "",
      status: vehicle.status || "",
    });
    setShowModal(true);
  }

  async function saveVehicle() {
    console.log("Save vehicle called, formData:", formData);
    if (!formData.make.trim() || !formData.model.trim()) {
      showCustomAlert(t("common.error"), t("vehicles.makeModelRequired"));
      return;
    }

    // Clients must select a garage
    if (user?.role === "CLIENT" && !editingVehicle && !formData.garageId) {
      showCustomAlert(t("common.error"), t("vehicles.garageRequired"));
      return;
    }

    // Garages must select a client
    if (user?.role === "GARAGE" && !editingVehicle && !formData.ownerId) {
      showCustomAlert(t("common.error"), t("vehicles.clientRequired"));
      return;
    }

    console.log("Validation passed, saving vehicle...");
    try {
      if (editingVehicle) {
        // Update
        const data = await api.put(`/api/vehicles/${editingVehicle.id}`, formData);
        if (data?.vehicle) {
          showCustomAlert(t("common.success"), t("vehicles.updateSuccess"));
          setShowModal(false);
          loadData();
        }
      } else {
        // Create
        const data = await api.post("/api/vehicles", formData);
        if (data?.vehicle) {
          showCustomAlert(t("common.success"), t("vehicles.addSuccess"));
          setShowModal(false);
          loadData();
        }
      }
    } catch (e) {
      console.error("Failed to save vehicle:", e);
      showCustomAlert(t("common.error"), e.message || t("vehicles.saveError"));
    }
  }

  async function deleteVehicle(vehicle) {
    Alert.alert(
      t("vehicles.deleteConfirm"),
      t("vehicles.deleteMessage", { make: vehicle.make, model: vehicle.model }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.del(`/api/vehicles/${vehicle.id}`);
              showCustomAlert(t("common.success"), t("vehicles.deleteSuccess"));
              loadData();
            } catch (e) {
              console.error("Failed to delete vehicle:", e);
              showCustomAlert(t("common.error"), e.message || t("vehicles.deleteError"));
            }
          },
        },
      ]
    );
  }

  const selectedGarage = garages.find(g => g.id === formData.garageId);

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1600&auto=format&fit=crop",
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

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>{t("vehicles.title")}</Text>
          </View>

          <TouchableOpacity
            onPress={openAddModal}
            style={styles.addBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color={C.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="car-off" size={64} color={C.sub} />
            <Text style={styles.emptyText}>
              {user?.role === "CLIENT" ? t("vehicles.noVehicles") : t("vehicles.noVehiclesGarage")}
            </Text>
            {user?.role === "CLIENT" && (
              <TouchableOpacity style={styles.addFirstBtn} onPress={openAddModal}>
                <Text style={styles.addFirstBtnText}>{t("vehicles.addFirst")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                userRole={user?.role}
                onEdit={() => openEditModal(item)}
                onDelete={() => deleteVehicle(item)}
                onStatusUpdate={async (newStatus) => {
                  try {
                    await api.put(`/api/vehicles/${item.id}`, { status: newStatus });
                    loadData();
                  } catch (e) {
                    showCustomAlert(t("common.error"), e.message);
                  }
                }}
                t={t}
              />
            )}
          />
        )}
      </SafeAreaView>

      {/* Add/Edit Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingVehicle ? t("vehicles.editVehicle") : t("vehicles.addVehicle")}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Client Selection (for garages only, when creating) */}
              {user?.role === "GARAGE" && !editingVehicle && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("vehicles.selectClient")} *</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={async () => {
                      if (clients.length === 0) {
                        try {
                          const clientsData = await api.get("/api/messages/users/CLIENT");
                          if (clientsData?.users && clientsData.users.length > 0) {
                            setClients(clientsData.users);
                            setShowModal(false);
                            setTimeout(() => {
                              setShowClientPicker(true);
                            }, 300);
                          } else {
                            showCustomAlert(t("common.error"), t("vehicles.noClientsAvailable"));
                          }
                        } catch (e) {
                          console.error("Failed to load clients:", e);
                          showCustomAlert(t("common.error"), e.message || t("vehicles.loadClientsError"));
                        }
                      } else {
                        setShowModal(false);
                        setTimeout(() => {
                          setShowClientPicker(true);
                        }, 300);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={formData.ownerId ? styles.pickerText : styles.pickerPlaceholder}>
                      {formData.ownerId 
                        ? clients.find(c => c.id === formData.ownerId)?.name || t("vehicles.clientSelected")
                        : t("vehicles.selectClientPlaceholder")}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={C.sub} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Garage Selection (for clients only, when creating) */}
              {user?.role === "CLIENT" && !editingVehicle && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("vehicles.selectGarage")} *</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={async () => {
                      console.log("Garage picker pressed, garages count:", garages.length);
                      if (garages.length === 0) {
                        // Try to reload garages
                        try {
                          console.log("Loading garages...");
                          const garagesData = await api.get("/api/vehicles/garages");
                          console.log("Garages loaded:", garagesData?.garages?.length);
                          if (garagesData?.garages && garagesData.garages.length > 0) {
                            setGarages(garagesData.garages);
                            // Close add modal and open garage picker
                            setShowModal(false);
                            setTimeout(() => {
                              setShowGaragePicker(true);
                            }, 300);
                          } else {
                            showCustomAlert(t("common.error"), t("vehicles.noGaragesAvailable"));
                          }
                        } catch (e) {
                          console.error("Failed to load garages:", e);
                          showCustomAlert(t("common.error"), e.message || t("vehicles.loadGaragesError"));
                        }
                      } else {
                        // Close add modal and open garage picker
                        setShowModal(false);
                        setTimeout(() => {
                          setShowGaragePicker(true);
                        }, 300);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={selectedGarage ? styles.pickerText : styles.pickerPlaceholder}>
                      {selectedGarage ? selectedGarage.name : t("vehicles.selectGaragePlaceholder")}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={C.sub} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.make")} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.make}
                  onChangeText={(text) => setFormData({ ...formData, make: text })}
                  placeholder={t("vehicles.makePlaceholder")}
                  placeholderTextColor={C.sub}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.model")} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.model}
                  onChangeText={(text) => setFormData({ ...formData, model: text })}
                  placeholder={t("vehicles.modelPlaceholder")}
                  placeholderTextColor={C.sub}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>{t("vehicles.year")}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.year}
                    onChangeText={(text) => setFormData({ ...formData, year: text.replace(/[^0-9]/g, "") })}
                    placeholder="2020"
                    placeholderTextColor={C.sub}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t("vehicles.color")}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.color}
                    onChangeText={(text) => setFormData({ ...formData, color: text })}
                    placeholder={t("vehicles.colorPlaceholder")}
                    placeholderTextColor={C.sub}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.vin")}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.vin}
                  onChangeText={(text) => setFormData({ ...formData, vin: text.toUpperCase() })}
                  placeholder={t("vehicles.vinPlaceholder")}
                  placeholderTextColor={C.sub}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.licensePlate")}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.licensePlate}
                  onChangeText={(text) => setFormData({ ...formData, licensePlate: text.toUpperCase() })}
                  placeholder={t("vehicles.licensePlatePlaceholder")}
                  placeholderTextColor={C.sub}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.mileage")}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.mileage}
                  onChangeText={(text) => setFormData({ ...formData, mileage: text.replace(/[^0-9]/g, "") })}
                  placeholder="50000"
                  placeholderTextColor={C.sub}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("vehicles.notes")}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder={t("vehicles.notesPlaceholder")}
                  placeholderTextColor={C.sub}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={saveVehicle}
              >
                <Text style={styles.modalBtnSaveText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Garage Picker Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={showGaragePicker}
        onRequestClose={() => {
          setShowGaragePicker(false);
          // Reopen add modal after closing garage picker
          setTimeout(() => {
            setShowModal(true);
          }, 300);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("vehicles.selectGarage")}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowGaragePicker(false);
                  // Reopen add modal after closing garage picker
                  setTimeout(() => {
                    setShowModal(true);
                  }, 300);
                }}
              >
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            {garages.length === 0 ? (
              <View style={[styles.center, { padding: 40 }]}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.emptyText}>{t("common.loading")}</Text>
              </View>
            ) : (
              <FlatList
                data={garages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.garageItem}
                    onPress={() => {
                      console.log("Garage selected:", item.name);
                      setFormData({ ...formData, garageId: item.id });
                      setShowGaragePicker(false);
                      // Reopen add modal with selected garage
                      setTimeout(() => {
                        setShowModal(true);
                      }, 300);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="garage" size={24} color={C.amber} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.garageName}>{item.name}</Text>
                      <Text style={styles.garageEmail}>{item.email}</Text>
                    </View>
                    {formData.garageId === item.id && (
                      <Ionicons name="checkmark-circle" size={24} color={C.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={[styles.center, { padding: 40 }]}>
                    <MaterialCommunityIcons name="garage-alert" size={48} color={C.sub} />
                    <Text style={styles.emptyText}>{t("vehicles.noGaragesAvailable")}</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Client Picker Modal (for garages) */}
      <Modal
        transparent
        animationType="slide"
        visible={showClientPicker}
        onRequestClose={() => {
          setShowClientPicker(false);
          setTimeout(() => {
            setShowModal(true);
          }, 300);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("vehicles.selectClient")}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowClientPicker(false);
                  setTimeout(() => {
                    setShowModal(true);
                  }, 300);
                }}
              >
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            {clients.length === 0 ? (
              <View style={[styles.center, { padding: 40 }]}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.emptyText}>{t("common.loading")}</Text>
              </View>
            ) : (
              <FlatList
                data={clients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.garageItem}
                    onPress={() => {
                      console.log("Client selected:", item.name);
                      setFormData({ ...formData, ownerId: item.id });
                      setShowClientPicker(false);
                      setTimeout(() => {
                        setShowModal(true);
                      }, 300);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="account" size={24} color={C.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.garageName}>{item.name}</Text>
                      <Text style={styles.garageEmail}>{item.email}</Text>
                    </View>
                    {formData.ownerId === item.id && (
                      <Ionicons name="checkmark-circle" size={24} color={C.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={[styles.center, { padding: 40 }]}>
                    <MaterialCommunityIcons name="account-alert" size={48} color={C.sub} />
                    <Text style={styles.emptyText}>{t("vehicles.noClientsAvailable")}</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function VehicleCard({ vehicle, userRole, onEdit, onDelete, onStatusUpdate, t }) {
  const statusColors = {
    PENDING: C.amber,
    IN_FIXING: C.primary,
    DONE: C.green,
  };

  const statusLabels = {
    PENDING: t("vehicles.statusPending"),
    IN_FIXING: t("vehicles.statusInFixing"),
    DONE: t("vehicles.statusDone"),
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="car" size={24} color={C.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardTitle}>
              {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.year && (
              <Text style={styles.cardSubtitle}>
                {vehicle.year} {vehicle.color ? `• ${vehicle.color}` : ""}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          {/* Both clients and garages can edit */}
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color={C.primary} />
          </TouchableOpacity>
          {/* Only clients can delete their vehicles */}
          {userRole === "CLIENT" && (
            <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={20} color={C.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[vehicle.status] || C.sub}20` }]}>
          <Text style={[styles.statusText, { color: statusColors[vehicle.status] || C.sub }]}>
            {statusLabels[vehicle.status] || vehicle.status}
          </Text>
        </View>
        {userRole === "GARAGE" && (
          <View style={styles.statusButtons}>
            {vehicle.status !== "PENDING" && (
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: `${C.amber}20` }]}
                onPress={() => onStatusUpdate("PENDING")}
              >
                <Text style={[styles.statusBtnText, { color: C.amber }]}>
                  {t("vehicles.statusPending")}
                </Text>
              </TouchableOpacity>
            )}
            {vehicle.status !== "IN_FIXING" && (
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: `${C.primary}20` }]}
                onPress={() => onStatusUpdate("IN_FIXING")}
              >
                <Text style={[styles.statusBtnText, { color: C.primary }]}>
                  {t("vehicles.statusInFixing")}
                </Text>
              </TouchableOpacity>
            )}
            {vehicle.status !== "DONE" && (
              <TouchableOpacity
                style={[styles.statusBtn, { backgroundColor: `${C.green}20` }]}
                onPress={() => onStatusUpdate("DONE")}
              >
                <Text style={[styles.statusBtnText, { color: C.green }]}>
                  {t("vehicles.statusDone")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        {/* Show garage info for clients */}
        {userRole === "CLIENT" && vehicle.garage && (
          <InfoRow
            icon="garage-outline"
            label={t("vehicles.garage")}
            value={vehicle.garage.name}
          />
        )}
        {/* Show client info for garages */}
        {userRole === "GARAGE" && vehicle.owner && (
          <InfoRow
            icon="person-outline"
            label={t("vehicles.client")}
            value={vehicle.owner.name}
          />
        )}
        {vehicle.vin && (
          <InfoRow icon="barcode-outline" label={t("vehicles.vin")} value={vehicle.vin} />
        )}
        {vehicle.licensePlate && (
          <InfoRow icon="card-outline" label={t("vehicles.licensePlate")} value={vehicle.licensePlate} />
        )}
        {vehicle.mileage && (
          <InfoRow icon="speedometer-outline" label={t("vehicles.mileage")} value={`${vehicle.mileage.toLocaleString()} km`} />
        )}
        {vehicle.notes && (
          <View style={styles.notesRow}>
            <Ionicons name="document-text-outline" size={16} color={C.sub} />
            <Text style={styles.notesText}>{vehicle.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={C.sub} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
