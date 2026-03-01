'use client';

import { PackageCheck } from 'lucide-react';
import ComingSoon from '../../../components/ui/ComingSoon';

export default function SoftwarePage() {
  return (
    <ComingSoon
      icon={PackageCheck}
      title="Software & Licenses Module"
      subtitle="This module is currently under development. Soon you'll be able to track software installations, manage license compliance, and monitor renewal deadlines here."
      accentColor="#8B5CF6"
    />
  );
}
