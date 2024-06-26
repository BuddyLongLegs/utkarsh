interface NewJobOpening {
  title: string;
  description: string;
  location: string;
  role: string;
  pay: string;
  payNumeric: number;
  empBenefits: string;
  company: {
    name: string;
    domain: string;
    logo: string;
  } | null;
  jobType: string | null;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  extraApplicationFields: extraApplicationField[] | null;
  hidden: boolean;
  autoApprove: boolean;
  autoVisible: boolean;
  participatingGroups: {
    admissionYear?: number;
    program?: string;
    minCgpa?: number;
    minCredits?: number;
  }[];
}

type extraApplicationField = {
  title: string;
  description: string;
  format: string;
  required: boolean;
};
