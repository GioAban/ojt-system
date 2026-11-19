package com.iodev.practicum.model;

import jakarta.persistence.*;

/** Skill na hinahanap ng isang company (para sa buong company, hindi bawat department) */
@Entity
@Table(name = "company_skill", uniqueConstraints = @UniqueConstraint(name = "uk_company_skill", columnNames = {"company_id", "skill_id"}))
public class CompanySkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;

    public CompanySkill() {}

    public CompanySkill(Company company, Skill skill) {
        this.company = company;
        this.skill = skill;
    }

    public Long getId() { return id; }
    public Company getCompany() { return company; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
}
