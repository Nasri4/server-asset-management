'use client';

import { Users } from 'lucide-react';
import ComingSoon from '../../../components/ui/ComingSoon';

export default function EmployeesPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Employees & Users Module"
      subtitle="This module is currently under development. Soon you'll be able to manage employee profiles, role assignments, asset allocations, and organizational access controls here."
      accentColor="#10B981"
    />
  );
}
