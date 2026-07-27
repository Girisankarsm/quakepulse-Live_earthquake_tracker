import { useEffect, useState } from 'react';
import { BrandMark } from './icons';

const STEPS = [
  'Connecting to USGS…',
  'Parsing seismic events…',
  'Computing analytics…',
  'Warming risk model…',
];

export function BootLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="boot-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-stage">
        <div className="boot-orbits" aria-hidden>
          <span className="boot-ring boot-ring-a" />
          <span className="boot-ring boot-ring-b" />
          <span className="boot-ring boot-ring-c" />
          <span className="boot-wave" />
          <div className="boot-core">
            <BrandMark />
          </div>
        </div>

        <p className="boot-eyebrow">QuakePulse</p>
        <h1 className="boot-title">Seismic Intelligence</h1>
        <p className="boot-copy" key={step}>
          {STEPS[step]}
        </p>

        <div className="boot-progress" aria-hidden>
          <span />
        </div>

        <div className="boot-steps" aria-hidden>
          {STEPS.map((label, i) => (
            <span key={label} className={i === step ? 'is-active' : i < step ? 'is-done' : ''}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
