package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Hiling ng student na magdagdag ng company at/o department na wala pa sa listahan.
 * Ang coordinator ang nag-aapprove o nagde-decline. Status: PENDING, APPROVED, DECLINED.
 * Hindi pa ito totoong Company/Department hangga't hindi naa-approve.
 */
@Entity
@Table(name = "company_requests")
public class CompanyRequest {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String DECLINED = "DECLINED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    /** Kung department lang ang hinihiling sa company na nasa listahan na */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "existing_company_id")
    private Company existingCompany;

    @Column(name = "company_name", nullable = false)
    private String companyName;

    @Column(nullable = false)
    private String address;

    @Column(name = "contact_number", nullable = false, length = 50)
    private String contactNumber;

    private String location;

    @Column(name = "department_name", nullable = false)
    private String departmentName;

    @Column(name = "supervisor_fullname", nullable = false)
    private String supervisorFullname;

    @Column(name = "supervisor_position")
    private String supervisorPosition;

    @Column(name = "supervisor_email")
    private String supervisorEmail;

    @Column(name = "supervisor_contact_number", length = 50)
    private String supervisorContactNumber;

    @Column(columnDefinition = "LONGTEXT")
    private String note;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "decline_reason", columnDefinition = "LONGTEXT")
    private String declineReason;

    @Column(name = "result_company_id")
    private Long resultCompanyId;

    @Column(name = "result_department_id")
    private Long resultDepartmentId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public CompanyRequest() {}

    public Long getId() { return id; }
    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }
    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public Company getExistingCompany() { return existingCompany; }
    public void setExistingCompany(Company existingCompany) { this.existingCompany = existingCompany; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
    public String getSupervisorFullname() { return supervisorFullname; }
    public void setSupervisorFullname(String supervisorFullname) { this.supervisorFullname = supervisorFullname; }
    public String getSupervisorPosition() { return supervisorPosition; }
    public void setSupervisorPosition(String supervisorPosition) { this.supervisorPosition = supervisorPosition; }
    public String getSupervisorEmail() { return supervisorEmail; }
    public void setSupervisorEmail(String supervisorEmail) { this.supervisorEmail = supervisorEmail; }
    public String getSupervisorContactNumber() { return supervisorContactNumber; }
    public void setSupervisorContactNumber(String supervisorContactNumber) { this.supervisorContactNumber = supervisorContactNumber; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDeclineReason() { return declineReason; }
    public void setDeclineReason(String declineReason) { this.declineReason = declineReason; }
    public Long getResultCompanyId() { return resultCompanyId; }
    public void setResultCompanyId(Long resultCompanyId) { this.resultCompanyId = resultCompanyId; }
    public Long getResultDepartmentId() { return resultDepartmentId; }
    public void setResultDepartmentId(Long resultDepartmentId) { this.resultDepartmentId = resultDepartmentId; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
