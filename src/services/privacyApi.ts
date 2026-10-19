import { http } from "./http";

export interface PrivacySectionDto {
  heading: string;
  body: string;
}

export interface PrivacyPolicyDto {
  version: number;
  retentionDays: number;
  sections: PrivacySectionDto[];
}

export interface PrivacyConsentDto {
  currentVersion: number;
  acceptedVersion?: number;
  acceptedAt?: string;
  // Đã đồng ý đúng bản chính sách hiện hành.
  accepted: boolean;
}

// Chính sách dữ liệu chấm công (vị trí GPS, ảnh) lấy từ backend (nguồn duy nhất cho web và mobile) và sự đồng ý của từng người.
export const privacyApi = {
  getPolicy: () => http.get<PrivacyPolicyDto>("/privacy/policy"),
  getConsent: () => http.get<PrivacyConsentDto>("/privacy/consent"),
  accept: () => http.post<PrivacyConsentDto>("/privacy/consent"),
  withdraw: () => http.delete<PrivacyConsentDto>("/privacy/consent"),
};
