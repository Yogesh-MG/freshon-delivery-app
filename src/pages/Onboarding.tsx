import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  Bike,
  Car,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  Loader2,
  Truck,
  Upload,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { FreshOnLogo } from "@/components/freshon/Logo";
import { DeliveryPartnerService, DocType, KycDocument, KycStatus } from "@/lib/deliveryPartnerService";

type DocTypeConfig = { id: DocType; label: string; hint: string };

const DOC_LIST: DocTypeConfig[] = [
  { id: "aadhaar", label: "Aadhaar Card", hint: "12-digit UID — front & back" },
  { id: "pan", label: "PAN Card", hint: "10-character alphanumeric" },
  { id: "driving_licence", label: "Driving Licence", hint: "Valid 2-wheeler / 4-wheeler" },
  { id: "vehicle_rc", label: "Vehicle RC", hint: "Registration certificate" },
  { id: "insurance", label: "Vehicle Insurance", hint: "Active policy document" },
];

const VEHICLES = [
  { id: "CYCLE" as const, name: "Bicycle", icon: Bike },
  { id: "SCOOTER" as const, name: "E-Scooter", icon: Zap },
  { id: "BIKE" as const, name: "Motorbike", icon: Car },
  { id: "VAN" as const, name: "Van", icon: Truck },
];

// name/phone are sourced from the partner's account (set at sign-up) and shown
// read-only here — only the fields below are editable and persisted.
const profileSchema = z.object({
  vehicle_type: z.enum(["CYCLE", "SCOOTER", "BIKE", "VAN"]),
  vehicle_number: z.string().trim().min(4, "Enter a valid vehicle number").max(20),
  address: z.string().trim().min(5, "Enter your full address").max(200),
  city: z.string().trim().min(2, "Enter your city").max(60),
  pincode: z.string().trim().regex(/^\d{4,8}$/, "Enter a valid pincode"),
});

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);

  // Profile state
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    vehicle_type: "SCOOTER" as "CYCLE" | "SCOOTER" | "BIKE" | "VAN",
    vehicle_number: "",
    address: "",
    city: "",
    pincode: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Docs state
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [uploadingFor, setUploadingFor] = useState<DocType | null>(null);
  const [docNumbers, setDocNumbers] = useState<Record<DocType, string>>({
    aadhaar: "",
    pan: "",
    driving_licence: "",
    vehicle_rc: "",
    insurance: "",
  });
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Load existing data
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    setLoading(true);
    
    // Load profile
    const profileResult = await DeliveryPartnerService.getProfile();
    if (profileResult.success && profileResult.data) {
      const p = profileResult.data;
      setProfile({
        full_name: p.name || "",
        phone: p.phone || "",
        vehicle_type: p.vehicle_type,
        vehicle_number: p.vehicle_number || "",
        address: p.address || "",
        city: p.city || "",
        pincode: p.pincode || "",
      });
    }

    // Load documents
    const docsResult = await DeliveryPartnerService.getKycDocuments();
    if (docsResult.success && docsResult.data) {
      setDocuments(docsResult.data.documents);
      setKycStatus(docsResult.data.kyc_status);
      
      // Pre-fill doc numbers from existing documents
      const existingNumbers: Record<DocType, string> = {
        aadhaar: "",
        pan: "",
        driving_licence: "",
        vehicle_rc: "",
        insurance: "",
      };
      docsResult.data.documents.forEach((doc) => {
        if (doc.doc_number) {
          existingNumbers[doc.doc_type] = doc.doc_number;
        }
      });
      setDocNumbers(existingNumbers);
      
      // If KYC is complete, skip to step 3
      if (docsResult.data.kyc_status.is_complete) {
        setStep(3);
      }
    }

    setLoading(false);
  };

  const saveProfile = async () => {
    const parsed = profileSchema.safeParse(profile);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSavingProfile(true);

    const result = await DeliveryPartnerService.updateProfile({
      vehicle_type: profile.vehicle_type,
      vehicle_number: profile.vehicle_number,
      address: profile.address,
      city: profile.city,
      pincode: profile.pincode,
    });

    if (result.success) {
      toast.success("Profile saved");
      setStep(2);
    } else {
      toast.error(result.error || "Failed to save profile");
    }
    setSavingProfile(false);
  };

  const handleUpload = async (docType: DocType, file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max file size is 8 MB");
      return;
    }

    setUploadingFor(docType);

    const result = await DeliveryPartnerService.uploadKycDocument(
      docType,
      docNumbers[docType] || "",
      file
    );

    if (result.success && result.data) {
      setDocuments(result.data.documents);
      setKycStatus(result.data.kyc_status);
      toast.success(`${DOC_LIST.find((d) => d.id === docType)?.label} uploaded`);
    } else {
      toast.error(result.error || "Upload failed");
    }

    setUploadingFor(null);
  };

  const submitKyc = async () => {
    if (!kycStatus?.is_complete) {
      toast.error("Upload all 5 documents first");
      return;
    }

    setSubmittingKyc(true);
    toast.success("KYC submitted! Review takes ~24h.");
    setStep(3);
    setSubmittingKyc(false);
  };

  const getDocumentStatus = (docType: DocType): KycDocument | undefined => {
    return documents.find((d) => d.doc_type === docType);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <PhoneFrame>
          <div className="grid h-full place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PhoneFrame>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <PhoneFrame>
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between px-5 pt-6">
            <FreshOnLogo />
            <div className="w-10" />
          </header>

          {/* Stepper */}
          <div className="mx-5 mt-5 flex items-center gap-2">
            <StepDot n={1} active={step >= 1} done={step > 1} label="Profile" />
            <div className={`h-0.5 flex-1 rounded-full ${step > 1 ? "bg-primary" : "bg-border"}`} />
            <StepDot n={2} active={step >= 2} done={step > 2} label="KYC Docs" />
            <div className={`h-0.5 flex-1 rounded-full ${step > 2 ? "bg-primary" : "bg-border"}`} />
            <StepDot n={3} active={step >= 3} done={false} label="Status" />
          </div>

          <div className="flex-1 space-y-4 px-5 pb-10 pt-5">
            {step === 1 && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Your details</h2>
                  <p className="text-sm text-muted-foreground">We&apos;ll use these for dispatch and payouts.</p>
                </div>
                <div className="space-y-3 rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                  <Field label="Full name">
                    <input
                      className="field cursor-not-allowed opacity-70"
                      value={profile.full_name}
                      readOnly
                      placeholder="From your account"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className="field cursor-not-allowed opacity-70"
                      value={profile.phone}
                      readOnly
                      placeholder="From your account"
                    />
                  </Field>
                  <div>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Vehicle
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {VEHICLES.map((v) => {
                        const Icon = v.icon;
                        const active = profile.vehicle_type === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setProfile({ ...profile, vehicle_type: v.id })}
                            className={`flex flex-col items-center gap-1 rounded-2xl p-2.5 text-[10px] font-bold transition
                              ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                          >
                            <Icon className="h-4 w-4" /> {v.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Field label="Vehicle number">
                    <input
                      className="field uppercase"
                      value={profile.vehicle_number}
                      onChange={(e) => setProfile({ ...profile, vehicle_number: e.target.value.toUpperCase() })}
                      placeholder="MH 12 AB 1234"
                      maxLength={20}
                    />
                  </Field>
                  <Field label="Address">
                    <textarea
                      className="field min-h-[72px] py-3"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      maxLength={200}
                      placeholder="Your residential address"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City">
                      <input
                        className="field"
                        value={profile.city}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        maxLength={60}
                        placeholder="City"
                      />
                    </Field>
                    <Field label="Pincode">
                      <input
                        className="field"
                        value={profile.pincode}
                        onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                        maxLength={8}
                        placeholder="Pincode"
                      />
                    </Field>
                  </div>
                </div>

                <button onClick={saveProfile} disabled={savingProfile} className="btn-primary w-full">
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save & continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Upload your documents</h2>
                  <p className="text-sm text-muted-foreground">JPG, PNG, WEBP or PDF · max 8 MB each</p>
                  {kycStatus && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {kycStatus.uploaded_count}/{kycStatus.required_count} uploaded
                      </span>
                      {kycStatus.is_complete && (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600">
                          Complete
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  {DOC_LIST.map((d) => {
                    const doc = getDocumentStatus(d.id);
                    const uploaded = !!doc;
                    const isUploading = uploadingFor === d.id;
                    return (
                      <div
                        key={d.id}
                        className={`rounded-2xl p-3 ring-1 transition
                        ${uploaded ? "bg-primary-soft ring-primary/40" : "bg-card ring-border"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl
                            ${uploaded ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                          >
                            {uploaded ? getStatusIcon(doc.status) : <FileCheck2 className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-bold text-foreground">{d.label}</div>
                              {uploaded && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
                                  ${doc?.status === "verified" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}
                                >
                                  {doc?.status_display}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{d.hint}</div>
                            {doc?.rejection_reason && (
                              <div className="mt-1 text-xs text-red-500">{doc.rejection_reason}</div>
                            )}
                            <input
                              type="text"
                              placeholder="Document number (optional)"
                              value={docNumbers[d.id]}
                              onChange={(e) => setDocNumbers({ ...docNumbers, [d.id]: e.target.value })}
                              maxLength={40}
                              className="field mt-2 h-10 text-xs"
                            />
                            <label
                              className={`mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition
                              ${isUploading ? "bg-muted text-muted-foreground" : uploaded ? "bg-secondary text-secondary-foreground" : "bg-gradient-amber text-accent-foreground shadow-glow-amber"}`}
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" /> {uploaded ? "Replace file" : "Upload file"}
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUpload(d.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="rounded-2xl bg-muted px-4 py-3.5 text-sm font-bold text-foreground">
                    Back
                  </button>
                  <button
                    onClick={submitKyc}
                    disabled={!kycStatus?.is_complete || submittingKyc}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {submittingKyc && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit for verification <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {!kycStatus?.is_complete && (
                  <p className="text-center text-xs text-muted-foreground">
                    Upload all {kycStatus?.required_count || 5} documents to continue.
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fade-up">
                <div className="grid place-items-center py-8">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">KYC Submitted!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your documents are under review. This usually takes 24 hours.
                  </p>
                </div>

                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Document Status
                  </h3>
                  <div className="space-y-2">
                    {DOC_LIST.map((d) => {
                      const doc = getDocumentStatus(d.id);
                      return (
                        <div key={d.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                          <span className="text-sm font-medium text-foreground">{d.label}</span>
                          {doc ? (
                            <span
                              className={`flex items-center gap-1 text-xs font-bold
                              ${doc.status === "verified" ? "text-green-600" : doc.status === "rejected" ? "text-red-500" : "text-amber-600"}`}
                            >
                              {getStatusIcon(doc.status)}
                              {doc.status_display}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">Not uploaded</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button onClick={() => navigate("/")} className="btn-primary w-full">
                  Go to Dashboard <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </PhoneFrame>

      <style>{`
        .field { width: 100%; height: 44px; border-radius: 12px; padding: 0 12px;
          background: hsl(var(--background)); border: 1px solid hsl(var(--border));
          font-size: 14px; font-weight: 500; color: hsl(var(--foreground));
          outline: none; transition: all .15s; }
        .field:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15); }
        textarea.field { height: auto; }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          height: 48px; border-radius: 14px; padding: 0 20px;
          background: var(--gradient-primary); color: hsl(var(--primary-foreground));
          font-size: 14px; font-weight: 700; box-shadow: var(--shadow-glow-primary);
          transition: transform .15s; }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
      `}</style>
    </main>
  );
};

const StepDot = ({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) => (
  <div className="flex items-center gap-2">
    <div
      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold transition
      ${done ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : n}
    </div>
    <span className={`text-xs font-bold uppercase tracking-wider ${active ? "text-foreground" : "text-muted-foreground"}`}>
      {label}
    </span>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    {children}
  </label>
);

export default Onboarding;
