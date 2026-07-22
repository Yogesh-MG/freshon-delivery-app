import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
    AlertCircle,
    CheckCircle,
    CheckCircle2,
    ChevronRight,
    Clock,
    FileCheck2,
    IndianRupee,
    Landmark,
    Loader2,
    Truck,
    Upload,
    Bike,
    Zap,
} from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { DeliveryPartnerService, DocType, KycDocument, KycStatus } from "@/lib/deliveryPartnerService";

type DocTypeConfig = { id: DocType; label: string; hint: string };

const DOC_LIST: DocTypeConfig[] = [
    { id: "aadhaar", label: "Aadhaar Card", hint: "12-digit UID — front & back" },
    { id: "pan", label: "PAN Card", hint: "10-character alphanumeric" },
    { id: "driving_licence", label: "Driving Licence", hint: "Valid 2-wheeler / 4-wheeler" },
    { id: "vehicle_rc", label: "Vehicle RC", hint: "Registration certificate" },
    { id: "insurance", label: "Vehicle Insurance", hint: "Active policy document" },
];

// lucide-react has no motorcycle glyph, so use a custom one drawn in lucide's
// stroke style (24x24, currentColor, round caps) for the Motorbike option.
const Motorbike = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <circle cx="5" cy="16.5" r="3.5" />
        <circle cx="19" cy="16.5" r="3.5" />
        <path d="M5 16.5 9 9.5h5.5l4 7" />
        <path d="M14.5 9.5 16.5 6H20" />
        <path d="M9 9.5 7.5 6.5" />
    </svg>
);

const VEHICLES = [
    { id: "SCOOTER" as const, name: "Scooty", icon: Motorbike },
    { id: "BIKE" as const, name: "Motorbike", icon: Bike },
    { id: "VAN" as const, name: "Van", icon: Truck },
];

type VehicleId = (typeof VEHICLES)[number]["id"];

// Bicycles are no longer accepted. A legacy CYCLE partner loading this form
// falls back to the nearest option and has to confirm it before saving.
const toVehicleId = (value: string): VehicleId =>
    VEHICLES.some((v) => v.id === value) ? (value as VehicleId) : "SCOOTER";

const STEPS = ["Profile", "Payout", "KYC", "Status"] as const;

// A first-time partner enters their name & phone here; returning partners see
// the values prefilled from their account and can edit them. All fields below
// are persisted via updateProfile.
const profileSchema = z.object({
    full_name: z.string().trim().min(2, "Enter your full name").max(80),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit number"),
    vehicle_type: z.enum(["SCOOTER", "BIKE", "VAN"]),
    vehicle_number: z.string().trim().min(4, "Enter a valid vehicle number").max(20),
    address: z.string().trim().min(5, "Enter your full address").max(200),
    city: z.string().trim().min(2, "Enter your city").max(60),
    pincode: z.string().trim().regex(/^\d{4,8}$/, "Enter a valid pincode"),
});

// Step 2 — payment KYC (how the partner gets paid).
const payoutSchema = z
    .object({
        payout_method: z.enum(["UPI", "BANK"], {
            errorMap: () => ({ message: "Choose how you want to get paid" }),
        }),
        bank_upi: z.string().trim().default(""),
        bank_account_name: z.string().trim().default(""),
        bank_account_number: z.string().trim().default(""),
        bank_ifsc: z.string().trim().default(""),
    })
    .superRefine((val, ctx) => {
        if (val.payout_method === "UPI") {
            if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(val.bank_upi)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bank_upi"], message: "Enter a valid UPI ID (e.g. name@oksbi)" });
            }
        } else if (val.payout_method === "BANK") {
            if (val.bank_account_name.length < 2) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bank_account_name"], message: "Enter the account holder name" });
            }
            if (!/^\d{9,18}$/.test(val.bank_account_number)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bank_account_number"], message: "Enter a valid account number" });
            }
            if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(val.bank_ifsc)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bank_ifsc"], message: "Enter a valid IFSC code" });
            }
        }
    });

const Onboarding = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Smoothly reset scroll to the top whenever the step changes.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    // Profile state
    const [profile, setProfile] = useState({
        full_name: "",
        phone: "",
        vehicle_type: "SCOOTER" as VehicleId,
        vehicle_number: "",
        address: "",
        city: "",
        pincode: "",
        payout_method: "" as "" | "UPI" | "BANK",
        bank_upi: "",
        bank_account_name: "",
        bank_account_number: "",
        bank_ifsc: "",
    });
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPayout, setSavingPayout] = useState(false);

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
    // Phone comes from the verified OTP login — lock it once it's known.
    const [phoneLocked, setPhoneLocked] = useState(false);

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
                vehicle_type: toVehicleId(p.vehicle_type),
                vehicle_number: p.vehicle_number || "",
                address: p.address || "",
                city: p.city || "",
                pincode: p.pincode || "",
                payout_method: p.payout_method || "",
                bank_upi: p.bank_upi || "",
                bank_account_name: p.bank_account_name || "",
                bank_account_number: p.bank_account_number || "",
                bank_ifsc: p.bank_ifsc || "",
            });
            setPhoneLocked(!!p.phone);
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

            // If KYC is complete, skip to the status step
            if (docsResult.data.kyc_status.is_complete) {
                setStep(4);
            }
        }

        setLoading(false);
    };

    // Step 1 — personal + vehicle details.
    const saveProfile = async () => {
        const parsed = profileSchema.safeParse(profile);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0].message);
            return;
        }
        setSavingProfile(true);

        const result = await DeliveryPartnerService.updateProfile({
            name: profile.full_name.trim(),
            phone: profile.phone.trim(),
            vehicle_type: profile.vehicle_type,
            vehicle_number: profile.vehicle_number,
            address: profile.address,
            city: profile.city,
            pincode: profile.pincode,
        });

        if (result.success) {
            toast.success("Details saved");
            setStep(2);
        } else {
            toast.error(result.error || "Failed to save details");
        }
        setSavingProfile(false);
    };

    // Step 2 — payment KYC (payout method).
    const savePayout = async () => {
        const parsed = payoutSchema.safeParse(profile);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0].message);
            return;
        }
        setSavingPayout(true);

        const isUpi = profile.payout_method === "UPI";
        const result = await DeliveryPartnerService.updateProfile({
            payout_method: profile.payout_method as "UPI" | "BANK",
            // Only send the fields relevant to the chosen method.
            bank_upi: isUpi ? profile.bank_upi.trim() : "",
            bank_account_name: isUpi ? "" : profile.bank_account_name.trim(),
            bank_account_number: isUpi ? "" : profile.bank_account_number.trim(),
            bank_ifsc: isUpi ? "" : profile.bank_ifsc.trim().toUpperCase(),
        });

        if (result.success) {
            toast.success("Payout details saved");
            setStep(3);
        } else {
            toast.error(result.error || "Failed to save payout details");
        }
        setSavingPayout(false);
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
        setStep(4);
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
            <main className="h-dvh overflow-hidden">
                <PhoneFrame>
                    <div className="grid h-full place-items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </PhoneFrame>
            </main>
        );
    }

    return (
        <main className="h-dvh overflow-hidden">
            <PhoneFrame>
                <div className="flex h-full flex-col">
                    <header className="px-7 pt-7">
                        <Wordmark />

                        {/* Progress — step name + a thin bar, nothing more. */}
                        <div className="mt-6 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                            <span className="text-foreground">{STEPS[step - 1]}</span>
                            <span>{step} / {STEPS.length}</span>
                        </div>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-gradient-primary transition-all duration-300"
                                style={{ width: `${(step / STEPS.length) * 100}%` }}
                            />
                        </div>
                    </header>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-7 pb-10 pt-6">
                        {step === 1 && (
                            <form
                                className="space-y-3 animate-fade-up"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    saveProfile();
                                }}
                            >
                                <input
                                    className="field"
                                    value={profile.full_name}
                                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                    placeholder="Full name"
                                    aria-label="Full name"
                                    maxLength={80}
                                    autoCapitalize="words"
                                    autoComplete="name"
                                    enterKeyHint="next"
                                />

                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                                        +91
                                    </span>
                                    <input
                                        className={`field ${phoneLocked ? "cursor-not-allowed opacity-60" : ""}`}
                                        style={{ paddingLeft: "3.25rem" }}
                                        value={profile.phone}
                                        onChange={(e) => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                                        placeholder="98765 43210"
                                        aria-label="Phone number"
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={10}
                                        autoComplete="tel"
                                        enterKeyHint="next"
                                        readOnly={phoneLocked}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    {VEHICLES.map((v) => {
                                        const Icon = v.icon;
                                        const active = profile.vehicle_type === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => setProfile({ ...profile, vehicle_type: v.id })}
                                                className={`flex min-h-[72px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl text-[11px] font-bold transition active:scale-95
                          ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-card text-muted-foreground ring-1 ring-border"}`}
                                            >
                                                <Icon className="h-5 w-5" /> {v.name}
                                            </button>
                                        );
                                    })}
                                </div>

                                <input
                                    className="field uppercase"
                                    value={profile.vehicle_number}
                                    onChange={(e) => setProfile({ ...profile, vehicle_number: e.target.value.toUpperCase() })}
                                    placeholder="Vehicle number (KA  01  AB  0123) "
                                    aria-label="Vehicle number"
                                    maxLength={20}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    autoComplete="off"
                                    spellCheck={false}
                                    enterKeyHint="next"
                                />

                                <textarea
                                    className="field min-h-[80px] py-4"
                                    value={profile.address}
                                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                    maxLength={200}
                                    placeholder="Address"
                                    aria-label="Address"
                                    rows={2}
                                    autoCapitalize="sentences"
                                    autoComplete="street-address"
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        className="field"
                                        value={profile.city}
                                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                                        maxLength={60}
                                        placeholder="City"
                                        aria-label="City"
                                        autoCapitalize="words"
                                        autoComplete="address-level2"
                                        enterKeyHint="next"
                                    />
                                    <input
                                        className="field"
                                        value={profile.pincode}
                                        onChange={(e) =>
                                            setProfile({ ...profile, pincode: e.target.value.replace(/\D/g, "").slice(0, 8) })
                                        }
                                        maxLength={8}
                                        placeholder="Pincode"
                                        aria-label="Pincode"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        autoComplete="postal-code"
                                        enterKeyHint="done"
                                    />
                                </div>

                                <button type="submit" disabled={savingProfile} className="btn-primary !mt-5">
                                    {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Continue <ChevronRight className="h-4 w-4" />
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <form
                                className="space-y-3 animate-fade-up"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    savePayout();
                                }}
                            >
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { id: "UPI", label: "UPI", icon: IndianRupee },
                                        { id: "BANK", label: "Bank account", icon: Landmark },
                                    ] as const).map((m) => {
                                        const Icon = m.icon;
                                        const active = profile.payout_method === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => setProfile({ ...profile, payout_method: m.id })}
                                                className={`flex min-h-[56px] touch-manipulation items-center justify-center gap-2 rounded-2xl text-sm font-bold transition active:scale-95
                        ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-card text-muted-foreground ring-1 ring-border"}`}
                                            >
                                                <Icon className="h-4 w-4" /> {m.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {profile.payout_method === "UPI" && (
                                    <input
                                        className="field"
                                        value={profile.bank_upi}
                                        onChange={(e) => setProfile({ ...profile, bank_upi: e.target.value.trim() })}
                                        placeholder="UPI ID · name@oksbi"
                                        aria-label="UPI ID"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        autoComplete="off"
                                        spellCheck={false}
                                        inputMode="email"
                                        enterKeyHint="done"
                                    />
                                )}

                                {profile.payout_method === "BANK" && (
                                    <>
                                        <input
                                            className="field"
                                            value={profile.bank_account_name}
                                            onChange={(e) => setProfile({ ...profile, bank_account_name: e.target.value })}
                                            placeholder="Account holder name"
                                            aria-label="Account holder name"
                                            maxLength={120}
                                            autoCapitalize="words"
                                            enterKeyHint="next"
                                        />
                                        <input
                                            className="field"
                                            value={profile.bank_account_number}
                                            onChange={(e) =>
                                                setProfile({ ...profile, bank_account_number: e.target.value.replace(/\D/g, "").slice(0, 18) })
                                            }
                                            placeholder="Account number"
                                            aria-label="Account number"
                                            inputMode="numeric"
                                            maxLength={18}
                                            autoComplete="off"
                                            enterKeyHint="next"
                                        />
                                        <input
                                            className="field uppercase"
                                            value={profile.bank_ifsc}
                                            onChange={(e) =>
                                                setProfile({ ...profile, bank_ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) })
                                            }
                                            placeholder="IFSC code"
                                            aria-label="IFSC code"
                                            maxLength={11}
                                            autoCapitalize="characters"
                                            autoCorrect="off"
                                            autoComplete="off"
                                            spellCheck={false}
                                            enterKeyHint="done"
                                        />
                                    </>
                                )}

                                <div className="flex gap-2 !mt-5">
                                    <button type="button" onClick={() => setStep(1)} className="btn-back">
                                        Back
                                    </button>
                                    <button type="submit" disabled={savingPayout} className="btn-primary flex-1">
                                        {savingPayout && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Continue <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div className="space-y-3 animate-fade-up">
                                <p className="text-center text-xs text-muted-foreground">
                                    {kycStatus?.uploaded_count ?? 0}/{kycStatus?.required_count ?? DOC_LIST.length} uploaded · JPG, PNG, WEBP or PDF · max 8 MB
                                </p>

                                {DOC_LIST.map((d) => {
                                    const doc = getDocumentStatus(d.id);
                                    const uploaded = !!doc;
                                    const isUploading = uploadingFor === d.id;
                                    return (
                                        <div
                                            key={d.id}
                                            className={`rounded-2xl p-3.5 ring-1 transition
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
                                                    {doc?.rejection_reason && (
                                                        <div className="mt-1 text-xs text-red-500">{doc.rejection_reason}</div>
                                                    )}
                                                    <input
                                                        type="text"
                                                        placeholder="Document number (optional)"
                                                        aria-label={`${d.label} number`}
                                                        value={docNumbers[d.id]}
                                                        onChange={(e) => {
                                                            const upper = ["pan", "driving_licence", "vehicle_rc"].includes(d.id);
                                                            const raw = d.id === "aadhaar" ? e.target.value.replace(/\D/g, "") : e.target.value;
                                                            setDocNumbers({ ...docNumbers, [d.id]: upper ? raw.toUpperCase() : raw });
                                                        }}
                                                        maxLength={40}
                                                        inputMode={d.id === "aadhaar" ? "numeric" : "text"}
                                                        autoCapitalize={["pan", "driving_licence", "vehicle_rc"].includes(d.id) ? "characters" : "none"}
                                                        autoCorrect="off"
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        enterKeyHint="done"
                                                        className={`field mt-2 h-12 text-sm${["pan", "driving_licence", "vehicle_rc"].includes(d.id) ? " uppercase" : ""}`}
                                                    />
                                                    <label
                                                        className={`mt-2 flex min-h-[44px] cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition active:scale-[.98]
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

                                <div className="flex gap-2 !mt-5">
                                    <button type="button" onClick={() => setStep(2)} className="btn-back">
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitKyc}
                                        disabled={!kycStatus?.is_complete || submittingKyc}
                                        className="btn-primary flex-1"
                                    >
                                        {submittingKyc && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Submit <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="animate-fade-up">
                                <div className="grid place-items-center pt-4">
                                    <div className="grid h-20 w-20 place-items-center rounded-full bg-green-500/10">
                                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                                    </div>
                                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">Submitted</h2>
                                    <p className="mt-1 text-center text-sm text-muted-foreground">
                                        Your documents are under review — usually within 24 hours.
                                    </p>
                                </div>

                                <div className="mt-6 space-y-2">
                                    {DOC_LIST.map((d) => {
                                        const doc = getDocumentStatus(d.id);
                                        return (
                                            <div key={d.id} className="flex items-center justify-between rounded-2xl bg-card p-3.5 ring-1 ring-border">
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

                                <button onClick={() => navigate("/")} className="btn-primary mt-5">
                                    Go to Dashboard <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </PhoneFrame>

            <style>{`
        .field { width: 100%; height: 56px; border-radius: 16px; padding: 0 16px;
          background: hsl(var(--card)); border: 1px solid hsl(var(--border));
          font-size: 16px; font-weight: 600; color: hsl(var(--foreground));
          outline: none; transition: border-color .15s, box-shadow .15s;
          -webkit-appearance: none; appearance: none;
          /* keep focused inputs clear of the sticky header when scrolled into view */
          scroll-margin-top: 84px; scroll-margin-bottom: 24px; }
        .field::placeholder { font-weight: 500; color: hsl(var(--muted-foreground) / 0.5); }
        .field:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15); }
        textarea.field { height: auto; line-height: 1.5; }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; height: 56px; border-radius: 16px; padding: 0 20px;
          background: var(--gradient-primary); color: hsl(var(--primary-foreground));
          font-size: 15px; font-weight: 700; box-shadow: var(--shadow-glow-primary);
          transition: transform .12s ease; touch-action: manipulation;
          -webkit-tap-highlight-color: transparent; user-select: none; }
        .btn-primary:active:not(:disabled) { transform: scale(.97); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
        .btn-back { height: 56px; border-radius: 16px; padding: 0 22px;
          background: hsl(var(--muted)); color: hsl(var(--foreground));
          font-size: 15px; font-weight: 700; touch-action: manipulation;
          transition: transform .12s ease; }
        .btn-back:active { transform: scale(.97); }
      `}</style>
        </main>
    );
};

// Text-only brand mark — no icon, matching the sign-in screen's wordmark.
const Wordmark = () => (
    <div className="text-center">
        <div className="text-xl font-extrabold tracking-tight text-foreground">
            FreshOn<span className="text-primary"> Go</span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Partner</div>
    </div>
);

export default Onboarding;
