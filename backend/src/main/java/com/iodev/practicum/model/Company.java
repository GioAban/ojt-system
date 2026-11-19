package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "companies")
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    private String location;

    @Column(name = "contact_number", nullable = false)
    private String contactNumber;

    @Column(name = "imsup_fullname", nullable = false)
    private String imsupFullname;

    @Column(name = "imsup_position", nullable = false)
    private String imsupPosition;

    /** Contact ng immediate supervisor; ginagamit kapag walang supervisor ang department ng student */
    @Column(name = "imsup_contact_number")
    private String imsupContactNumber;

    @Column(name = "imsup_email")
    private String imsupEmail;

    @Column(name = "imsup_comp_evid_identity")
    private String imsupCompEvidIdentity;

    @Column(name = "imsup_comp_evid_identity_no")
    private String imsupCompEvidIdentityNo;

    private String logo;

    @ManyToOne
    @JoinColumn(name = "nature_id")
    private CompanyNature nature;

    /** Paliwanag kapag "Other" ang nature (hal. "Hospitality"); null kung hindi Other o wala pang laman */
    @Column(name = "nature_other", length = 100)
    private String natureOther;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    // ---- Hiling mula sa public link ng company (null sa lahat ng iba pang company) ----

    /** "company_link" kapag ang company mismo ang nagsumite gamit ang link */
    @Column(name = "request_source", length = 30)
    private String requestSource;

    /**
     * null o "approved" = karaniwang company. "pending", "rejected" o "merged" = hiling pa lang (o tapos na)
     * kaya nakatago sa lahat ng listahan, bilang, report at assignment (tingnan ang CompanyRepository).
     */
    @Column(name = "request_status", length = 20)
    private String requestStatus;

    @Column(name = "request_reviewed_at")
    private java.time.LocalDateTime requestReviewedAt;

    /** Dahilan ng pag-reject, o kung saan na-merge */
    @Column(name = "request_reason", length = 1000)
    private String requestReason;

    /** Skills na tinype ng company; hindi pa nasa catalog hangga't hindi naa-approve (isa bawat linya) */
    @Column(name = "request_skills", length = 1000)
    private String requestSkills;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Company() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }

    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getImsupFullname() { return imsupFullname; }
    public void setImsupFullname(String imsupFullname) { this.imsupFullname = imsupFullname; }

    public String getImsupPosition() { return imsupPosition; }
    public void setImsupPosition(String imsupPosition) { this.imsupPosition = imsupPosition; }

    public String getImsupContactNumber() { return imsupContactNumber; }
    public void setImsupContactNumber(String imsupContactNumber) { this.imsupContactNumber = imsupContactNumber; }

    public String getImsupEmail() { return imsupEmail; }
    public void setImsupEmail(String imsupEmail) { this.imsupEmail = imsupEmail; }

    public String getImsupCompEvidIdentity() { return imsupCompEvidIdentity; }
    public void setImsupCompEvidIdentity(String imsupCompEvidIdentity) { this.imsupCompEvidIdentity = imsupCompEvidIdentity; }

    public String getImsupCompEvidIdentityNo() { return imsupCompEvidIdentityNo; }
    public void setImsupCompEvidIdentityNo(String imsupCompEvidIdentityNo) { this.imsupCompEvidIdentityNo = imsupCompEvidIdentityNo; }

    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }

    public CompanyNature getNature() { return nature; }
    public void setNature(CompanyNature nature) { this.nature = nature; }

    public String getNatureOther() { return natureOther; }
    public void setNatureOther(String natureOther) { this.natureOther = natureOther; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public String getRequestSource() { return requestSource; }
    public void setRequestSource(String requestSource) { this.requestSource = requestSource; }
    public String getRequestStatus() { return requestStatus; }
    public void setRequestStatus(String requestStatus) { this.requestStatus = requestStatus; }
    public java.time.LocalDateTime getRequestReviewedAt() { return requestReviewedAt; }
    public void setRequestReviewedAt(java.time.LocalDateTime requestReviewedAt) { this.requestReviewedAt = requestReviewedAt; }
    public String getRequestReason() { return requestReason; }
    public void setRequestReason(String requestReason) { this.requestReason = requestReason; }
    public String getRequestSkills() { return requestSkills; }
    public void setRequestSkills(String requestSkills) { this.requestSkills = requestSkills; }

    /** Hiling na hindi pa approved (pending, rejected, merged): hindi dapat makita kahit saan maliban sa review */
    public boolean isHiddenRequest() {
        return requestStatus != null && !requestStatus.isBlank() && !requestStatus.equalsIgnoreCase("approved");
    }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}