"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Medal, Clock, Users, Target, Shield, Dumbbell, ChevronDown } from "lucide-react";

export default function Home() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+34612345678";
  const whatsappMessage = process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE || "Hola Pablo, quiero información sobre los entrenamientos de natación";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="min-h-screen">
      {/* Navigation - Mobile First */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ocean-900/95 backdrop-blur-md">
        <div className="container-custom">
          <div className="flex items-center justify-between py-3 px-4 md:px-8">
            <div className="text-xl md:text-2xl font-bold text-white">
              Pablo<span className="text-water-light">RM</span>
            </div>
            {/* Menu mobile - solo icono WhatsApp */}
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-white/80 hover:text-white text-sm py-2 px-2 md:px-3">
                Acceder
              </Link>
              <Link href={whatsappUrl} target="_blank" className="btn-gold text-sm py-2 px-3 md:px-4 text-xs md:text-sm">
                <MessageCircle className="inline-block w-4 h-4 md:w-5 md:h-5 md:mr-1" />
                <span className="hidden md:inline">Contactar</span>
              </Link>
            </div>
          </div>
          {/* Menu bar scrollable en móvil */}
          <div className="flex overflow-x-auto gap-4 px-4 pb-3 text-xs md:hidden">
            <Link href="/login" className="text-ocean-100 hover:text-white whitespace-nowrap">
              Acceder
            </Link>
            <button onClick={() => scrollToSection("servicios")} className="text-ocean-100 hover:text-white whitespace-nowrap">
              Servicios
            </button>
            <button onClick={() => scrollToSection("audiencia")} className="text-ocean-100 hover:text-white whitespace-nowrap">
              Para quién
            </button>
            <button onClick={() => scrollToSection("galeria")} className="text-ocean-100 hover:text-white whitespace-nowrap">
              Galería
            </button>
            <button onClick={() => scrollToSection("contacto")} className="text-ocean-100 hover:text-white whitespace-nowrap">
              Contacto
            </button>
          </div>
          {/* Menu desktop */}
          <div className="hidden md:flex items-center justify-center gap-8 pb-4">
            <button onClick={() => scrollToSection("servicios")} className="text-ocean-100 hover:text-white transition-colors">
              Servicios
            </button>
            <button onClick={() => scrollToSection("audiencia")} className="text-ocean-100 hover:text-white transition-colors">
              Para quién
            </button>
            <button onClick={() => scrollToSection("galeria")} className="text-ocean-100 hover:text-white transition-colors">
              Galería
            </button>
            <button onClick={() => scrollToSection("contacto")} className="text-ocean-100 hover:text-white transition-colors">
              Contacto
            </button>
            <Link href="/login" className="text-ocean-100 hover:text-white transition-colors">
              Acceder
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Mobile First */}
      <section className="relative h-[85vh] md:h-screen flex items-center justify-center overflow-hidden">
        {/* Background - Imagen principal (funciona en todos lados) */}
        <div className="absolute inset-0">
          <Image 
            src="/Hero.JPEG" 
            alt="PabloRM Natación" 
            fill 
            priority
            className="object-cover"
          />
          {/* Video solo en desktop (md y adelante) */}
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="hidden md:block absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/swimming-hero.MP4" type="video/mp4" />
          </video>
          {/* Overlay gradiente */}
          <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/80 via-ocean-900/60 to-ocean-900/90 md:from-ocean-900/70 md:via-ocean-900/50" />
        </div>

        {/* Contenido Hero - Mobile First */}
        <div className="relative z-10 container-custom text-center px-4 pt-16">
          <div className="animate-fade-in">
            <h1 className="heading-1 text-white mb-4 md:mb-6">
              Domina el Agua, <span className="text-water-light">Alcanza tus Metas</span>
            </h1>
            <p className="text-base md:text-xl lg:text-2xl text-ocean-100 max-w-2xl lg:max-w-3xl mx-auto mb-6 md:mb-8">
              Entrenamientos personalizados de natación para quienes buscan superar sus límites.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link href={whatsappUrl} target="_blank" className="btn-gold text-base md:text-lg py-3 px-6">
                <MessageCircle className="inline-block w-5 h-5 md:w-6 md:h-6 mr-2" />
                Empezar Ahora
              </Link>
              <button onClick={() => scrollToSection("servicios")} className="btn-secondary text-base md:text-lg py-3 px-6 bg-white/10 border-white/30 text-white hover:bg-white/20">
                Conocer Más
              </button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <button 
          onClick={() => scrollToSection("servicios")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white animate-bounce"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </section>

      {/* Imagen decorativa entre secciones */}
      <div className="relative h-64 md:h-96">
        <Image 
          src="/Nadador.JPEG" 
          alt="Nadador entrenando" 
          fill 
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ocean-900/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-xl md:text-3xl font-bold text-center px-4">
            "Cada entrenamiento te acerca a tu objetivo"
          </p>
        </div>
      </div>

      {/* Servicios Section */}
      <section id="servicios" className="section-padding bg-ocean-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 mb-4">Servicios</h2>
            <p className="text-ocean-600 text-lg max-w-2xl mx-auto">
              Entrenamientos adaptados a tu objetivo. Presencial y online.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Servicio 1: Oposiciones */}
            <div className="card group">
              <div className="w-14 h-14 bg-ocean-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-ocean-200 transition-colors">
                <Shield className="w-7 h-7 text-ocean-600" />
              </div>
              <h3 className="heading-3 mb-3">Preparación para Oposiciones</h3>
              <p className="text-ocean-600 mb-4">
                Entrenamiento específico para superar las pruebas de natación de:
              </p>
              <ul className="text-ocean-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Bomberos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Policía Nacional
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Guardia Civil
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Militares
                </li>
              </ul>
            </div>

            {/* Servicio 2: Triatlón */}
            <div className="card group">
              <div className="w-14 h-14 bg-ocean-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-ocean-200 transition-colors">
                <Medal className="w-7 h-7 text-ocean-600" />
              </div>
              <h3 className="heading-3 mb-3">Triatlón</h3>
              <p className="text-ocean-600 mb-4">
                Preparación específica para las tres disciplinas con foco en el segmento de natación:
              </p>
              <ul className="text-ocean-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Técnica de brazada
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Resistencia en aguas abiertas
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Sprint, Olympic, Half & Full
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Salidas y virajes
                </li>
              </ul>
            </div>

            {/* Servicio 3: CrossFit / Gimnasios */}
            <div className="card group">
              <div className="w-14 h-14 bg-ocean-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-ocean-200 transition-colors">
                <Dumbbell className="w-7 h-7 text-ocean-600" />
              </div>
              <h3 className="heading-3 mb-3">CrossFit & Gimnasios</h3>
              <p className="text-ocean-600 mb-4">
                Servicio para box de CrossFit que quieren ofrecer actividades acuáticas:
              </p>
              <ul className="text-ocean-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Clases grupales en piscina
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Entrenamiento funcional en agua
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Recuperación y rehabilitación
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-ocean-400 rounded-full" /> Metcon acuático
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Audiencia Objetivo */}
      <section id="audiencia" className="section-padding bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 mb-4">¿Para quién es?</h2>
            <p className="text-ocean-600 text-lg max-w-2xl mx-auto">
              Trabajo con diferentes perfiles, siempre con un enfoque personalizado.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Card Opositores */}
            <div className="relative overflow-hidden rounded-2xl group">
              <div className="relative aspect-video">
                <Image 
                  src="/Nadador.JPEG" 
                  alt="Opositores" 
                  fill 
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/90 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="text-2xl font-bold text-white mb-2">Opositores</h3>
                <p className="text-ocean-100 mb-4">
                  Necesitas aprobar las pruebas físicas de natación. Te preparo específicamente 
                  para los tiempos y distancias requeridas.
                </p>
                <Link href={whatsappUrl} target="_blank" className="text-gold-light font-semibold hover:text-gold transition-colors">
                  Consultar preparación →
                </Link>
              </div>
            </div>

            {/* Card Triatletas */}
            <div className="relative overflow-hidden rounded-2xl group">
              <div className="relative aspect-video">
                <Image 
                  src="/Nadador.JPEG" 
                  alt="Triatletas y Nadadores" 
                  fill 
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/90 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="text-2xl font-bold text-white mb-2">Triatletas & Nadadores</h3>
                <p className="text-ocean-100 mb-4">
                  Desde mejorar tu técnica hasta preparar tu mejor marca. 
                  Todo tipo de distancias y niveles.
                </p>
                <Link href={whatsappUrl} target="_blank" className="text-gold-light font-semibold hover:text-gold transition-colors">
                  Consultar preparación →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Galería de Videos */}
      <section id="galeria" className="section-padding bg-ocean-900 text-white">
        <div className="container-custom">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="heading-2 mb-4">Galería</h2>
            <p className="text-ocean-200 text-lg max-w-2xl mx-auto">
              Entrenamientos en acción
            </p>
          </div>

          {/* Video principal */}
          <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden">
            <video 
              controls 
              className="w-full h-full object-contain bg-black"
              poster="/Nadador.JPEG"
            >
              <source src="/videos/swimming-hero.MP4" type="video/mp4" />
              Tu navegador no soporta el video.
            </video>
          </div>

          <div className="text-center mt-12">
            <p className="text-ocean-300">
              ¿Quieres ver más? <Link href={whatsappUrl} target="_blank" className="text-gold-light hover:text-gold font-semibold">Escríbeme por WhatsApp</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Por qué elegirme */}
      <section className="section-padding bg-ocean-50">
        <div className="container-custom">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 bg-ocean-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-ocean-700" />
              </div>
              <h3 className="text-xl font-bold text-ocean-800 mb-2">Experiencia</h3>
              <p className="text-ocean-600">Años de experiencia entrenando a opositores y atletas de todos los niveles</p>
            </div>
            <div>
              <div className="w-16 h-16 bg-ocean-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-ocean-700" />
              </div>
              <h3 className="text-xl font-bold text-ocean-800 mb-2">Enfoque Personalizado</h3>
              <p className="text-ocean-600">Cada cliente tiene un plan diseñado para sus objetivos específicos</p>
            </div>
            <div>
              <div className="w-16 h-16 bg-ocean-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-ocean-700" />
              </div>
              <h3 className="text-xl font-bold text-ocean-800 mb-2">Modalidad Flexible</h3>
              <p className="text-ocean-600">Entrenamientos presenciales y online. Adaptados a tu horario</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section id="contacto" className="section-padding bg-gradient-to-br from-ocean-800 to-ocean-900">
        <div className="container-custom text-center">
          <h2 className="heading-2 text-white mb-6">¿Listo para empezar?</h2>
          <p className="text-xl text-ocean-100 max-w-2xl mx-auto mb-8">
            Da el primer paso. Hablemos de tus objetivos y diseñemos juntos tu plan de entrenamiento.
          </p>
          <Link href={whatsappUrl} target="_blank" className="btn-gold text-lg inline-flex items-center">
            <MessageCircle className="w-6 h-6 mr-2" />
            Escribirme por WhatsApp
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ocean-950 py-8">
        <div className="container-custom px-4 md:px-8 text-center">
          <div className="text-2xl font-bold text-white mb-4">
            Pablo<span className="text-water-light">RM</span>
          </div>
          <p className="text-ocean-400 mb-4">
            Entrenador de Natación · Madrid, España
          </p>
          <div className="flex justify-center gap-6">
            <Link href={whatsappUrl} target="_blank" className="text-ocean-400 hover:text-water-light transition-colors">
              <MessageCircle className="w-6 h-6" />
            </Link>
          </div>
          <p className="text-ocean-500 text-sm mt-8">
            © {new Date().getFullYear()} PabloRM. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
