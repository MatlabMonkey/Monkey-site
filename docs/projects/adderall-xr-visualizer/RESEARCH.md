# Adderall XR Visualizer — Research Notes

Last updated: 2026-04-25 17:24 PDT

> This tool is educational/planning support, not medical advice or dosing guidance.

## Targeted pharmacology facts used in model

### 1) Adderall XR release behavior
- Mixed amphetamine salts extended-release capsules use a biphasic delivery profile.
- Practical modeling assumption: each capsule behaves like ~50% immediate-release + ~50% delayed-release pulse.
- Delayed pulse modeled with ~4 hour lag after ingestion.

### 2) Typical elimination timescale
- Adult amphetamine elimination half-life is on the order of ~10–13 hours (isomer-dependent; individual variability exists).
- Model baseline uses an effective half-life around this range, then modulates by acidification setting.

### 3) Urinary pH and elimination
- Amphetamine is a weak base; acidic urine increases ionization and renal excretion.
- Alkaline urine tends to reduce renal elimination and prolong exposure.
- Vitamin C is treated as a user-controlled acidification proxy that increases elimination rate during a configurable time window.

### 4) Effect lags concentration
- Clinical effect is not instant with plasma concentration; CNS effect commonly lags due to distribution/equilibration.
- Model uses a standard effect-compartment relationship: `dCe/dt = ke0 * (Cp - Ce)`.

## Modeling implications
- We separate:
  1) plasma concentration curve (`Cp`), and
  2) effect curve (`E(Ce)`), where `Ce` is delayed/filtered relative to `Cp`.
- We include repeated daily dosing and pre-roll simulation to approximate steady-state carryover.

## Known limitations
- Not a personalized medical model.
- Does not include CYP2D6 genotype, food interactions, comedications, renal/hepatic disease, or full urine chemistry.
- Vitamin C impact is represented as a tunable heuristic, not a clinically validated per-mg elimination converter.

## Sources consulted
- FDA/DailyMed label summaries for Adderall XR and amphetamine elimination characteristics.
- Standard PK/PD effect-compartment modeling conventions.
