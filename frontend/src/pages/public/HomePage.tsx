import React from 'react';
import { Navbar, BottomNav } from '../../components/layout/Navbar';
import SmartHomeHero from '../../components/home/SmartHomeHero';

export default function HomePage() {
  return (
    <div style={{ background:'#080808', minHeight:'100vh', paddingBottom:80 }}>
      <Navbar />
      <SmartHomeHero />
      <BottomNav />
    </div>
  );
}
