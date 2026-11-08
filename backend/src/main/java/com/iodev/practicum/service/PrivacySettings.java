package com.iodev.practicum.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Iisang pinagkukunan ng mga detalye ng Privacy Notice (RA 10173).
 * Itakda sa production gamit ang PRIVACY_DPO_NAME, PRIVACY_DPO_EMAIL at PRIVACY_RETENTION.
 * Palitan ang notice-version kapag binago ang teksto ng notice; tatanungin ulit ang mga student.
 */
@Component
public class PrivacySettings {

    @Value("${app.privacy.dpo-name}")
    private String dpoName;

    @Value("${app.privacy.dpo-email}")
    private String dpoEmail;

    @Value("${app.privacy.retention}")
    private String retention;

    @Value("${app.privacy.notice-version}")
    private String noticeVersion;

    public String getDpoName() { return dpoName; }
    public String getDpoEmail() { return dpoEmail; }
    public String getRetention() { return retention; }
    public String getNoticeVersion() { return noticeVersion; }

    /** Kailangan bang ipakita ulit ang acknowledgement: wala pang bersyon o iba na sa kasalukuyan */
    public boolean needsAcknowledgement(String acknowledgedVersion) {
        return acknowledgedVersion == null || acknowledgedVersion.isBlank()
                || !acknowledgedVersion.trim().equals(noticeVersion);
    }
}
