# Configuración de Cabezas de Serie en Torneos

## Objetivo

Este documento define cómo debe configurarse en la aplicación la distribución de **cabezas de serie (seeds)** en un torneo, tomando como base la lógica general del reglamento ATP, pero adaptada al funcionamiento interno de la plataforma.

El objetivo de los cabezas de serie es ordenar el cuadro de forma competitiva para evitar que los mejores posicionados se enfrenten entre sí en rondas demasiado tempranas.

---

## Definición de Cabeza de Serie

Un **cabeza de serie** es un jugador o pareja que recibe una ubicación preferente dentro del cuadro del torneo según su posición en el ranking correspondiente.

En esta aplicación, los cabezas de serie **no se definen por un ranking global**, sino por el **ranking en la organización-categoría-modalidad**.

Esto significa que:

- Cada **organización** tendrá su propio sistema de ranking.
- Dentro de cada organización, existirá un ranking separado por **categoría**.
- Además, cada categoría tendrá rankings distintos según la **modalidad**.

### Ejemplo práctico

Un jugador puede tener posiciones distintas según dónde compita:

- Organización: Club A
- Categoría: Honor
- Modalidad: Singles

Y también:

- Organización: Club A
- Categoría: Honor
- Modalidad: Dobles

O incluso:

- Organización: Club A
- Categoría: Primera
- Modalidad: Singles

Por lo tanto, la app debe interpretar que el seed de cada participante se calcula exclusivamente dentro de su combinación de:

**organización + categoría + modalidad**

---

## Regla General para Determinar los Seeds

Al momento de armar el cuadro:

1. Se identifican todos los jugadores o parejas aceptados en el torneo.
2. Se filtran según la **organización**, **categoría** y **modalidad** del evento.
3. Se ordenan de mejor a peor según el ranking aplicable a esa combinación.
4. Los mejores ubicados pasan a ser los **cabezas de serie** del cuadro.

---

## Cantidad de Cabezas de Serie según Tamaño del Cuadro

La aplicación debe configurar la cantidad de seeds según el tamaño total del cuadro.

### Regla de configuración

- **28 jugadores o menos**: 8 cabezas de serie
- **32 jugadores**: 8 cabezas de serie
- **48 o 56 jugadores**: 16 cabezas de serie
- **96 jugadores**: 32 cabezas de serie

### Regla operativa sugerida para la app

Si el cuadro tiene:

- **96 participantes** → 32 seeds
- **48 a 56 participantes** → 16 seeds
- **32 participantes o menos** → 8 seeds

De esta forma, para la lógica interna del sistema, cualquier cuadro de **28 o menos** también debe considerar **8 cabezas de serie**.

---

## Ubicación de los Cabezas de Serie en el Cuadro

Los cabezas de serie no solo se definen, sino que además deben distribuirse correctamente dentro del cuadro.

### Ubicaciones fijas principales

- El **Seed 1** debe ubicarse en la parte superior del cuadro.
- El **Seed 2** debe ubicarse en la parte inferior del cuadro.

### Resto de seeds

Los demás cabezas de serie deben distribuirse en zonas predeterminadas del cuadro mediante sorteo interno dentro de bloques permitidos, para mantener equilibrio competitivo.

La lógica que debe respetar la app es la siguiente:

- Seed 1 y Seed 2 solo pueden enfrentarse en la final.
- Los mejores 4 seeds no deben cruzarse antes de semifinales.
- Los mejores 8 seeds no deben cruzarse antes de cuartos de final.
- En cuadros mayores, la distribución debe seguir la misma lógica de protección progresiva.

---

## Lógica de Distribución que Debe Implementar la App

La app debe contemplar estas reglas al momento de generar el cuadro:

### Para 2 seeds

- Seed 1 arriba
- Seed 2 abajo

### Para 4 seeds

- Seed 1 arriba
- Seed 2 abajo
- Seed 3 y Seed 4 sorteados en mitades opuestas, respetando que no se enfrenten antes de semifinales

### Para 8 seeds

- Seed 1 arriba
- Seed 2 abajo
- Seed 3 y Seed 4 sorteados en cuartos opuestos
- Seed 5 al Seed 8 sorteados en posiciones que impidan cruces entre seeds altos antes de cuartos de final

### Para 16 o 32 seeds

Se aplica la misma lógica en bloques, distribuyendo los seeds para que los mejores posicionados avancen separados según la estructura del cuadro.

---

## Criterio de Ranking para Singles y Dobles

La app debe considerar diferencias entre modalidad individual y modalidad dobles.

### Singles

En singles, el seed se asigna según el ranking del jugador dentro de:

**organización + categoría + modalidad singles**

### Dobles

En dobles, el seed se asigna según el criterio que defina el sistema para la pareja dentro de:

**organización + categoría + modalidad dobles**

La implementación recomendada es que la app utilice una regla clara y consistente, por ejemplo:

- suma del ranking de ambos jugadores, o
- puntaje combinado de la pareja, o
- ranking específico de dobles si la organización lo administra por separado

Lo importante es que siempre se evalúe dentro de la misma combinación de:

**organización + categoría + modalidad**

---

## Reglas Importantes para la Configuración del Sistema

La aplicación debe dejar configurado lo siguiente:

1. Cada torneo debe estar asociado a una **organización**.
2. Cada torneo debe estar asociado a una **categoría**.
3. Cada torneo debe estar asociado a una **modalidad**.
4. El sistema debe consultar el ranking correcto según esos tres parámetros.
5. El sistema debe determinar automáticamente cuántos seeds corresponden según el tamaño del cuadro.
6. El sistema debe distribuir los seeds respetando la protección competitiva del cuadro.
7. El sistema no debe mezclar rankings entre categorías distintas.
8. El sistema no debe mezclar rankings entre singles y dobles.
9. El sistema no debe mezclar rankings entre organizaciones distintas.

---

## Ejemplo de Funcionamiento Esperado

Supongamos un torneo con estas características:

- Organización: F2 Sports
- Categoría: Honor
- Modalidad: Singles
- Tamaño del cuadro: 24 jugadores

Entonces la app debe:

1. Buscar el ranking de **F2 Sports + Honor + Singles**.
2. Ordenar a los 24 jugadores aceptados según ese ranking.
3. Tomar a los 8 mejores como cabezas de serie.
4. Ubicar al Seed 1 arriba y al Seed 2 abajo.
5. Distribuir los Seeds 3 al 8 en las zonas correspondientes del cuadro.

Aunque el cuadro sea de 24 y no de 32, la regla interna definida para esta app será igualmente:

**cuadro de 28 o menos = 8 seeds**

---

## Texto Sugerido para Mostrar en la App

Los cabezas de serie se asignan según el ranking correspondiente a la combinación de organización, categoría y modalidad del torneo. Esto significa que cada organización mantiene rankings separados por categoría y por modalidad, como por ejemplo Honor Singles, Honor Dobles, Primera Singles o Inicial Dobles. La cantidad de seeds se determina automáticamente según el tamaño del cuadro. En cuadros de 28 participantes o menos se asignan 8 cabezas de serie. Luego, estos se distribuyen en el cuadro de forma protegida para evitar cruces tempranos entre los mejores posicionados.

---

## Conclusión

La lógica de seeds en la aplicación debe entenderse como una configuración estructural del cuadro y no solo como una etiqueta visual.

Ser cabeza de serie implica dos cosas:

- estar entre los mejores rankeados de la combinación **organización-categoría-modalidad**, y
- ocupar una posición protegida dentro del cuadro.

Con esto, la app podrá generar cuadros consistentes, competitivos y alineados con una lógica similar a la utilizada en torneos profesionales, pero aterrizada a la estructura interna de la plataforma.
