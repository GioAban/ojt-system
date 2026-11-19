package com.iodev.practicum.model;

import jakarta.persistence.*;

/** Skill ng isang student (marami sa marami) */
@Entity
@Table(name = "student_skill", uniqueConstraints = @UniqueConstraint(name = "uk_student_skill", columnNames = {"student_id", "skill_id"}))
public class StudentSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;

    public StudentSkill() {}

    public StudentSkill(Student student, Skill skill) {
        this.student = student;
        this.skill = skill;
    }

    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
}
