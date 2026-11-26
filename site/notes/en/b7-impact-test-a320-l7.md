---
title: Reading an RFQ that asks for low-temperature impact tests on A193 B7: A320 L7 and the nuts
desc: What to ask back when an RFQ adds impact testing to A193 B7 studs, the A320 L7 alternative, and what to check on the nuts and certificates.
date: 2026-11-26
lib: gr-b7, astm-a193, gr-l7, astm-a320, gr-a194-7, astm-a194, t-charpy, t-en10204-types
---
A recent English RFQ described a flange stud like this: material ASTM A193 B7, impact test at a sub-zero test temperature, certificate EN 10204 3.1. Three requirements sit in one line. One Korean manufacturer we asked replied that it could not quote because of the impact test.

Lines like this come up often. This note covers how to read such a line, what to ask back, and how to split the answer between the quotation and the clarification & deviation (C&D) list.

## B7 is not a grade made for low temperature

ASTM A193 is a bolting material standard for high-temperature, high-pressure or special service. The standard itself points to A320 for low-temperature bolting. And the supplementary requirements (S) in A193 apply only when they are written into the order.

So "B7 + impact test" is not a requirement you can settle by reading the B7 standard alone. Read it as one extra order condition added on top, and check what that condition contains, item by item.

The ASME code side has a basis too. ASME VIII-1 interpretation VIII-81-68 (1981) answered that SA-193 B7 under 2-1/2" may be used down to −50 °F (−46 °C) only if it is impact tested or falls under a UCS-66 exemption. For a design that runs B7 at low temperature, an impact test requirement is therefore not an odd request in itself.

## Five things to ask back on one RFQ line

A supplier can quote a line with an impact test only when these five are fixed. Whatever is missing goes on the C&D list as a question.

1. **Test temperature**: at what temperature the test is made. The test temperature on the certificate is compared with the minimum design metal temperature (MDMT).
2. **Acceptance criterion**: how many joules of absorbed energy, whether it is a three-specimen average or also an individual minimum, and whether other criteria such as lateral expansion apply.
3. **Specimen size**: the standard specimen is 10 × 10 × 55 mm. Thin bolts use 7.5, 5 or 2.5 mm sub-size specimens, so how the criterion is read for sub-size specimens has to be agreed.
4. **Whether nuts and washers are included**: studs only, or the mating nuts under the same test.
5. **Certificate**: EN 10204 3.1 is a document confirmed by the manufacturer's inspection representative. A document re-created by a distributor is not 3.1.

## Alternative: proposing A320 L7 as a deviation

If no supplier can impact test B7 as specified, ASTM A320, the low-temperature bolting standard, offers grade L7 as an alternative to propose.

- **Strength**: for 2-1/2" and under, minimum tensile 125 ksi (862 MPa) and yield 105 ksi, the same class as B7.
- **Impact test**: average of three at −150 °F (−101 °C) of at least 20 ft·lbf (27 J). The impact test is part of the grade.
- **Basis**: ASME VIII-1 interpretation VIII-1-01-25 (2001) answered that SA-320 L7 impact tested at −150 °F may be used with SA-194 Grade 4 or 7 nuts carrying the low-temperature impact supplementary requirement at an MDMT of −150 °F or above.

But L7 is a **different grade under a different standard**. It is not supplied in place of B7 without the customer's approval. The quotation lists the original specification and the alternative side by side, and marks the alternative as "deviation, customer approval required". For L7 over 2-1/2", public sources list different diameter ranges, so check the table of the edition in force.

## The nuts are easy to miss

A320 also puts the nut material used with the bolting under impact testing. If only the studs are changed to L7 and the nuts stay ordinary 2H, the set is not a low-temperature combination. Match the nuts with impact-tested ones, such as A194 Grade 7 with the low-temperature impact supplementary requirement.

A194 forbids supplying another grade without the purchaser's permission. Treat a nut grade change as a deviation, exactly like the stud.

## Do not tell grades apart by the stamp alone

L7 and B7 look the same. On receipt, check the impact test record on the certificate (test temperature and absorbed energy) together with the stamp. Also check that the heat or lot number on the 3.1 certificate ties to the delivered product.

## Summary

- "B7 + impact test" is one more order condition. Confirm test temperature, acceptance criterion, specimen, whether nuts are included, and certificate type.
- If a supplier cannot impact test B7, propose A320 L7 with impact-tested A194 Grade 7 nuts as a deviation. Do not change anything before the customer approves.
- Confirmed conditions go on the quotation; unconfirmed conditions and deviations go on the C&D list.
