import { IconDownload } from "@tabler/icons-react";

const documents = [
  {
    title: "Penetration Test",
    description:
      "Penetration testing is performed at least annually by a third-party cybersecurity company.",
    detail: "You can download the Letter of Attestation below.",
    file: "/documents/penetration-test.pdf",
  },
  {
    title: "SOC 2",
    description:
      "Octopus is SOC 2 Type II compliant, a compliance framework developed by AICPA.",
    detail:
      "This audit was completed by Vanta & Advantage Partners and covers the period of February 1, 2024 to February 1, 2025.",
    file: "/documents/soc2.pdf",
  },
  {
    title: "DPA",
    description:
      "Data Processing Agreement (DPA) is a contract that regulates data processing conducted for business purposes.",
    detail:
      "The attached DPA is a version signed by us, and is considered fully executed once you sign up to Octopus.",
    file: "/documents/dpa.pdf",
  },
  {
    title: "Form W-9",
    description:
      "Form W-9 is a document used in the United States by individuals and entities to provide their taxpayer identification number (TIN) to a person or business that will pay them income.",
    detail: "You can download the signed Form W-9 below.",
    file: "/documents/form-w9.pdf",
  },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
        <p className="text-muted-foreground text-sm">
          Download compliance and legal documents.
        </p>
      </div>

      <div className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.title}
            className="rounded-lg border border-border p-6 space-y-3"
          >
            <h3 className="text-base font-semibold">{doc.title}</h3>
            <p className="text-muted-foreground text-sm">{doc.description}</p>
            <p className="text-muted-foreground text-sm">{doc.detail}</p>
            <a
              href={doc.file}
              download
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <IconDownload className="size-4" />
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
