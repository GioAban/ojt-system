package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;

@Entity
@Table(name = "students")
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @Column(name = "subject_code", nullable = false)
    private String subjectCode;

    @Column(name = "student_number", nullable = false)
    private String studentNumber;

    @Column(nullable = false)
    private String firstname;

    @Column(nullable = false)
    private String lastname;

    @Column(name = "middle_initial")
    private String middleInitial;

    private String image;

    @Column(nullable = false)
    private String gender;

    private String birthday;

    private String contact;

    private String year;

    @Column(nullable = false)
    private String status = "For Approval";

    @Column(name = "moa_status", length = 30)
    private String moaStatus;

    @Column(name = "deployed_date")
    private String deployedDate;

    @Column(name = "start_training_date")
    private String startTrainingDate;

    @Column(name = "completed_date")
    private String completedDate;

    @Column(name = "hired_date")
    private LocalDate hiredDate;

    @Column(name = "job_related_to_course")
    private String jobRelatedToCourse;

    @Column(name = "employability_level")
    private String employabilityLevel;

    @Column(name = "predicted_employability_level")
    private String predictedEmployabilityLevel;

    @Column(name = "prediction_confidence", precision = 5, scale = 2)
    private BigDecimal predictionConfidence;

    @Column(name = "predicted_at")
    private Timestamp predictedAt;

    @Column(name = "rendered_hours", precision = 10, scale = 2, nullable = false)
    private BigDecimal renderedHours = BigDecimal.ZERO;

    @Column(name = "training_duration", precision = 10, scale = 2)
    private BigDecimal trainingDuration;

    private String address;

    private String parent;

    private String guardian;

    @Column(unique = true)
    private String email;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String password;

    @Column(name = "temporary_password")
    private String temporaryPassword;

    @Column(name = "open_midterm_evaluation", nullable = false)
    private Boolean openMidtermEvaluation = false;

    @Column(name = "open_final_evaluation", nullable = false)
    private Boolean openFinalEvaluation = false;

    @Column(columnDefinition = "JSON")
    private String skills;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified = false;

    @Column(name = "device_token")
    private String deviceToken;

    @Column(name = "must_change_password", nullable = false)
    private Boolean mustChangePassword = false;

    private String otp;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Student() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }

    public Department getDepartment() { return department; }
    public void setDepartment(Department department) { this.department = department; }

    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }

    public String getSubjectCode() { return subjectCode; }
    public void setSubjectCode(String subjectCode) { this.subjectCode = subjectCode; }

    public String getStudentNumber() { return studentNumber; }
    public void setStudentNumber(String studentNumber) { this.studentNumber = studentNumber; }

    public String getFirstname() { return firstname; }
    public void setFirstname(String firstname) { this.firstname = firstname; }

    public String getLastname() { return lastname; }
    public void setLastname(String lastname) { this.lastname = lastname; }

    public String getMiddleInitial() { return middleInitial; }
    public void setMiddleInitial(String middleInitial) { this.middleInitial = middleInitial; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getBirthday() { return birthday; }
    public void setBirthday(String birthday) { this.birthday = birthday; }

    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }

    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getMoaStatus() { return moaStatus; }
    public void setMoaStatus(String moaStatus) { this.moaStatus = moaStatus; }

    public String getDeployedDate() { return deployedDate; }
    public void setDeployedDate(String deployedDate) { this.deployedDate = deployedDate; }

    public String getStartTrainingDate() { return startTrainingDate; }
    public void setStartTrainingDate(String startTrainingDate) { this.startTrainingDate = startTrainingDate; }

    public String getCompletedDate() { return completedDate; }
    public void setCompletedDate(String completedDate) { this.completedDate = completedDate; }

    public LocalDate getHiredDate() { return hiredDate; }
    public void setHiredDate(LocalDate hiredDate) { this.hiredDate = hiredDate; }

    public String getJobRelatedToCourse() { return jobRelatedToCourse; }
    public void setJobRelatedToCourse(String jobRelatedToCourse) { this.jobRelatedToCourse = jobRelatedToCourse; }

    public String getEmployabilityLevel() { return employabilityLevel; }
    public void setEmployabilityLevel(String employabilityLevel) { this.employabilityLevel = employabilityLevel; }

    public String getPredictedEmployabilityLevel() { return predictedEmployabilityLevel; }
    public void setPredictedEmployabilityLevel(String predictedEmployabilityLevel) { this.predictedEmployabilityLevel = predictedEmployabilityLevel; }

    public BigDecimal getPredictionConfidence() { return predictionConfidence; }
    public void setPredictionConfidence(BigDecimal predictionConfidence) { this.predictionConfidence = predictionConfidence; }

    public Timestamp getPredictedAt() { return predictedAt; }
    public void setPredictedAt(Timestamp predictedAt) { this.predictedAt = predictedAt; }

    public BigDecimal getRenderedHours() { return renderedHours; }
    public void setRenderedHours(BigDecimal renderedHours) { this.renderedHours = renderedHours; }

    public BigDecimal getTrainingDuration() { return trainingDuration; }
    public void setTrainingDuration(BigDecimal trainingDuration) { this.trainingDuration = trainingDuration; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getParent() { return parent; }
    public void setParent(String parent) { this.parent = parent; }

    public String getGuardian() { return guardian; }
    public void setGuardian(String guardian) { this.guardian = guardian; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getTemporaryPassword() { return temporaryPassword; }
    public void setTemporaryPassword(String temporaryPassword) { this.temporaryPassword = temporaryPassword; }

    public Boolean getOpenMidtermEvaluation() { return openMidtermEvaluation; }
    public void setOpenMidtermEvaluation(Boolean openMidtermEvaluation) { this.openMidtermEvaluation = openMidtermEvaluation; }

    public Boolean getOpenFinalEvaluation() { return openFinalEvaluation; }
    public void setOpenFinalEvaluation(Boolean openFinalEvaluation) { this.openFinalEvaluation = openFinalEvaluation; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Boolean getIsVerified() { return isVerified; }
    public void setIsVerified(Boolean isVerified) { this.isVerified = isVerified; }

    public String getDeviceToken() { return deviceToken; }
    public void setDeviceToken(String deviceToken) { this.deviceToken = deviceToken; }

    public Boolean getMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}