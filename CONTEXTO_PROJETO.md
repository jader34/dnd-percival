# Contexto do Projeto

## Visão Geral
Este projeto é uma ficha digital interativa de D&D 5E para o personagem Percival "O Triturador", pensada para uso direto no celular como um web app leve e hospedável no GitHub Pages.

## Estado Atual do Projeto
- Stack atual: HTML, CSS e Vanilla JavaScript.
- Estrutura principal: `index.html`, `style.css` e `app.js`.
- Layout mobile-first com visual dark mode, header fixo e navegação por abas na parte inferior.
- Persistência híbrida: `localStorage` como fallback local e Firestore para sincronização em tempo real quando configurado.
- Interface já cobre combate, características, magias e inventário.

## Comportamento Já Implementado
- Cabeçalho sticky com nome do personagem, classe, nível, CA, HP e botão de descanso longo.
- Barra inferior fixa com tabs: Combate, Traços, Magias e Inventário.
- Modal de dano/cura por toque longo nos controles de HP.
- Cálculos automáticos de atributos, proficiência, ataque, dano, CD de magia, ataque mágico, cura pelas mãos e sentido divino.
- Inventário com adição, remoção, descrição opcional e identificação visual de itens mágicos.
- Slots de magia com estado persistente.

## Direção Desejada
Atue como um Desenvolvedor Front-end Sênior especialista em interfaces Mobile-First. Sua tarefa é criar uma ficha de D&D 5E digital, interativa e otimizada para a tela de um celular, em estilo web app, usando apenas HTML, CSS e Vanilla JavaScript em um único arquivo ou em arquivos separados básicos, prontos para serem hospedados no GitHub Pages.

## Diretrizes de UX e UI
- Priorizar uso com uma mão, com alvos grandes e acessíveis.
- Manter visual escuro, limpo e consistente.
- Favorecer leitura rápida, ações frequentes e estados claros.
- Usar menu inferior fixo como navegação principal.
- Preservar sensação de app nativo, com animações discretas e úteis.
- Evitar excesso de ruído visual e interfaces genéricas.

## Requisitos Funcionais
- Exibir e editar HP, CA, slots, recursos e inventário.
- Permitir navegação rápida entre seções sem recarregar a página.
- Manter os dados após recarregar a página.
- Se houver sincronização, manter compatibilidade com Firestore.
- Funcionar de forma aceitável mesmo sem conexão, usando fallback local.

## Restrições Técnicas
- Não usar frameworks frontend.
- Não depender de build complexo.
- Manter compatibilidade com GitHub Pages.
- Preferir lógica simples, previsível e fácil de manter.

## Estrutura Atual de Arquivos
- `index.html`: estrutura da interface e seções do app.
- `style.css`: tema, layout mobile-first, componentes e animações.
- `app.js`: lógica de cálculo, renderização, persistência e sincronização.

## Observações de Implementação
- O projeto já está orientado a paladino nível 4.
- O sistema atual foi desenhado para ser expandido por dados, não por reescrita de lógica.
- Qualquer evolução futura deve preservar a experiência mobile-first e a navegação por tabs inferiores.

## Checklist de Qualidade
- Interface confortável em telas pequenas.
- Navegação clara com uma mão.
- Estados persistidos corretamente.
- Dados e cálculos coerentes com D&D 5E.
- Código simples o suficiente para manutenção direta no GitHub Pages.
